package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.function.IntSupplier;

import javax.sql.DataSource;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.example.krwwatcher.config.SyncProperties;
import com.example.krwwatcher.external.EcosClient;
import com.example.krwwatcher.external.FetchResult;
import com.example.krwwatcher.external.FetchStatus;
import com.example.krwwatcher.external.FredClient;
import com.example.krwwatcher.external.KoreaeximExchangeClient;
import com.example.krwwatcher.external.TwelveDataClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

class MarketDataSyncRunStateTest {

    private JdbcTemplate jdbcTemplate;
    private MarketDataSyncService marketDataSyncService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
        jdbcTemplate.execute("""
            CREATE TABLE batch_job_runs (
                id BIGINT NOT NULL AUTO_INCREMENT,
                job_name VARCHAR(100) NOT NULL,
                status VARCHAR(30) NOT NULL,
                started_at TIMESTAMP NOT NULL,
                ended_at TIMESTAMP NULL,
                message VARCHAR(1000) NULL,
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE batch_job_source_runs (
                id BIGINT NOT NULL AUTO_INCREMENT,
                batch_job_run_id BIGINT NULL,
                job_name VARCHAR(100) NOT NULL,
                source_name VARCHAR(100) NOT NULL,
                status VARCHAR(30) NOT NULL,
                rows_processed INT NOT NULL DEFAULT 0,
                error_code VARCHAR(100) NULL,
                error_message VARCHAR(1000) NULL,
                started_at TIMESTAMP NOT NULL,
                ended_at TIMESTAMP NULL,
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE intraday_exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                observed_at TIMESTAMP NOT NULL,
                currency_pair VARCHAR(20) NOT NULL,
                open_rate DECIMAL(19, 4) NOT NULL,
                high_rate DECIMAL(19, 4) NOT NULL,
                low_rate DECIMAL(19, 4) NOT NULL,
                close_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE usd_krw_intraday_backfill_attempts (
                id BIGINT NOT NULL AUTO_INCREMENT,
                session_key VARCHAR(50) NOT NULL,
                currency_pair VARCHAR(20) NOT NULL,
                session_start_date DATE NOT NULL,
                status VARCHAR(40) NOT NULL,
                rows_processed INT NOT NULL DEFAULT 0,
                previous_latest_observed_at TIMESTAMP NULL,
                latest_observed_at TIMESTAMP NULL,
                no_change_count INT NOT NULL DEFAULT 0,
                attempted_at TIMESTAMP NOT NULL,
                next_allowed_at TIMESTAMP NULL,
                message VARCHAR(1000) NULL,
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                currency_code VARCHAR(20) NOT NULL,
                currency_name VARCHAR(100) NOT NULL,
                deal_bas_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_exchange_rates_currency_date (currency_code, base_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE current_exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                currency_code VARCHAR(20) NOT NULL,
                currency_name VARCHAR(100) NOT NULL,
                deal_bas_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(80) NOT NULL,
                observed_at TIMESTAMP NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_current_exchange_rates_currency (currency_code)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE effective_exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                area_code VARCHAR(10) NOT NULL,
                area_name VARCHAR(100) NOT NULL,
                index_type VARCHAR(10) NOT NULL,
                basket_type VARCHAR(10) NOT NULL,
                value DECIMAL(19, 6) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE dollar_indexes (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                series_id VARCHAR(50) NOT NULL,
                value DECIMAL(19, 6) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_dollar_indexes_series_date (series_id, base_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE foreign_reserves (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                amount_usd_million DECIMAL(19, 4) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_foreign_reserves_base_date (base_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE domestic_policy_indicators (
                id BIGINT NOT NULL AUTO_INCREMENT,
                indicator_code VARCHAR(50) NOT NULL,
                title VARCHAR(100) NOT NULL,
                category VARCHAR(50) NOT NULL,
                base_date DATE NOT NULL,
                value DECIMAL(19, 4) NOT NULL,
                unit VARCHAR(30) NOT NULL,
                source VARCHAR(80) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_domestic_policy_indicator_date (indicator_code, base_date)
            )
            """);
        marketDataSyncService = new MarketDataSyncService(properties(), syncProperties(), null, null, null, null, null, null, null, jdbcTemplate);
    }

    @Test
    void failedCoreSourceCanRetryBeforeSuccessfulSourceCooldownExpires() {
        Instant now = Instant.parse("2026-07-21T00:00:00Z");
        insertSourceRun("MARKET_DATA_SYNC", "exchange", "FAILED", now);
        insertSourceRun("MARKET_DATA_SYNC", "dollarIndex", "SUCCESS", now);

        Boolean failedSourceCanRetry = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "canRunSource",
            "MARKET_DATA_SYNC",
            "exchange",
            Duration.ofMinutes(15),
            now.plus(Duration.ofMinutes(1))
        );
        Boolean successfulSourceCanRetry = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "canRunSource",
            "MARKET_DATA_SYNC",
            "dollarIndex",
            Duration.ofMinutes(15),
            now.plus(Duration.ofMinutes(1))
        );

        assertThat(failedSourceCanRetry).isTrue();
        assertThat(successfulSourceCanRetry).isFalse();
    }

    @Test
    void staleRunningJobDoesNotBlockManualSyncForever() {
        Instant now = Instant.parse("2026-07-21T03:00:00Z");
        jdbcTemplate.update(
            "INSERT INTO batch_job_runs (job_name, status, started_at, message) VALUES (?, ?, ?, ?)",
            "MARKET_DATA_SYNC",
            "RUNNING",
            now.minus(Duration.ofHours(3)),
            "old running"
        );

        Object syncWindow = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "currentSyncWindow",
            "MARKET_DATA_SYNC",
            Duration.ofMinutes(15),
            now
        );
        Object latestJob = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "findLatestJob",
            "MARKET_DATA_SYNC"
        );

        Boolean canSync = ReflectionTestUtils.invokeMethod(syncWindow, "canSync");
        String latestStatus = ReflectionTestUtils.invokeMethod(latestJob, "status");

        assertThat(canSync).isTrue();
        assertThat(latestStatus).isEqualTo("STALE_RUNNING");
    }

    @Test
    void startupCleanupMarksInterruptedMarketDataRunsAsFailed() {
        Instant startedAt = Instant.parse("2026-08-09T05:47:23Z");
        Instant cleanupAt = Instant.parse("2026-08-09T05:50:22Z");
        jdbcTemplate.update(
            "INSERT INTO batch_job_runs (job_name, status, started_at, message) VALUES (?, ?, ?, ?)",
            "MARKET_DATA_SYNC",
            "RUNNING",
            startedAt,
            "SCHEDULED sync started"
        );
        Long jobId = jdbcTemplate.queryForObject("SELECT MAX(id) FROM batch_job_runs", Long.class);
        jdbcTemplate.update(
            """
                INSERT INTO batch_job_source_runs
                    (batch_job_run_id, job_name, source_name, status, rows_processed, started_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
            jobId,
            "MARKET_DATA_SYNC",
            "exchange",
            "RUNNING",
            0,
            startedAt
        );
        jdbcTemplate.update(
            "INSERT INTO batch_job_runs (job_name, status, started_at, message) VALUES (?, ?, ?, ?)",
            "NEWS_SYNC",
            "RUNNING",
            startedAt,
            "news still running"
        );

        ReflectionTestUtils.invokeMethod(marketDataSyncService, "markInterruptedRunningJobs", cleanupAt);

        String jobRun = jdbcTemplate.queryForObject(
            "SELECT CONCAT(status, '|', ended_at IS NOT NULL, '|', message) FROM batch_job_runs WHERE id = ?",
            String.class,
            jobId
        );
        String sourceRun = jdbcTemplate.queryForObject(
            """
                SELECT CONCAT(status, '|', ended_at IS NOT NULL, '|', error_code, '|', error_message)
                FROM batch_job_source_runs
                WHERE batch_job_run_id = ?
                """,
            String.class,
            jobId
        );
        String unrelatedStatus = jdbcTemplate.queryForObject(
            "SELECT status FROM batch_job_runs WHERE job_name = 'NEWS_SYNC'",
            String.class
        );

        assertThat(jobRun).isEqualTo("FAILED|TRUE|SCHEDULED sync started, interrupted=backend-restarted");
        assertThat(sourceRun).isEqualTo("FAILED|TRUE|INTERRUPTED_BY_RESTART|Backend restarted before this source run completed.");
        assertThat(unrelatedStatus).isEqualTo("RUNNING");
    }

    @Test
    void sourceRunFailureIsRecordedWithStructuredErrorDetails() throws Exception {
        Class<?> counterClass = Class.forName("com.example.krwwatcher.service.MarketDataSyncService$SyncCounter");
        var constructor = counterClass.getDeclaredConstructor();
        constructor.setAccessible(true);
        Object counter = constructor.newInstance();
        IntSupplier failingSource = () -> {
            throw new IllegalStateException("ECOS quota exceeded");
        };

        Integer rows = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "runSource",
            null,
            "MARKET_DATA_SYNC",
            "krRate",
            counter,
            Duration.ofMinutes(15),
            failingSource
        );

        assertThat(rows).isZero();
        String sourceRun = jdbcTemplate.queryForObject(
            """
                SELECT CONCAT(job_name, '|', source_name, '|', status, '|', rows_processed, '|', error_code, '|', error_message)
                FROM batch_job_source_runs
                WHERE source_name = 'krRate'
                """,
            String.class
        );
        assertThat(sourceRun).isEqualTo("MARKET_DATA_SYNC|krRate|FAILED|0|IllegalStateException|ECOS quota exceeded");
    }

    @Test
    void abnormalFetchResultIsRecordedAsSourceRunFailure() throws Exception {
        Class<?> counterClass = Class.forName("com.example.krwwatcher.service.MarketDataSyncService$SyncCounter");
        var constructor = counterClass.getDeclaredConstructor();
        constructor.setAccessible(true);
        Object counter = constructor.newInstance();
        IntSupplier schemaMismatchSource = () -> FetchResult
            .failure(FetchStatus.SCHEMA_MISMATCH, "missing observations")
            .rowsOrThrow("FRED DEXKOUS")
            .size();

        Integer rows = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "runSource",
            null,
            "MARKET_DATA_SYNC",
            "exchange",
            counter,
            Duration.ofMinutes(15),
            schemaMismatchSource
        );

        assertThat(rows).isZero();
        String sourceRun = jdbcTemplate.queryForObject(
            """
                SELECT CONCAT(source_name, '|', status, '|', rows_processed, '|', error_code, '|', error_message)
                FROM batch_job_source_runs
                WHERE source_name = 'exchange'
                """,
            String.class
        );
        assertThat(sourceRun).isEqualTo("exchange|FAILED|0|ExternalApiFetchException|FRED DEXKOUS SCHEMA_MISMATCH: missing observations");
    }

    @Test
    void effectiveExchangeRatesSyncRunsInitiallyRegardlessOfWeekday() {
        Boolean shouldSync = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "shouldSyncEffectiveExchangeRates",
            LocalDateTime.of(2026, 7, 21, 9, 0)
        );

        assertThat(shouldSync).isTrue();
    }

    @Test
    void effectiveExchangeRatesSyncWaitsUntilSaturdayMorningAfterCurrentWeekIsSynced() {
        insertEffectiveExchangeRate(Instant.parse("2026-07-20T00:00:00Z"));
        insertSourceRun("MARKET_DATA_SYNC", "currencyStrength", "SUCCESS", Instant.parse("2026-07-18T00:10:00Z"));

        Boolean shouldSyncFriday = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "shouldSyncEffectiveExchangeRates",
            LocalDateTime.of(2026, 7, 24, 15, 0)
        );
        Boolean shouldSyncBeforeSaturdayClose = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "shouldSyncEffectiveExchangeRates",
            LocalDateTime.of(2026, 7, 25, 5, 59)
        );
        Boolean shouldSyncAfterSaturdayClose = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "shouldSyncEffectiveExchangeRates",
            LocalDateTime.of(2026, 7, 25, 6, 0)
        );

        assertThat(shouldSyncFriday).isFalse();
        assertThat(shouldSyncBeforeSaturdayClose).isFalse();
        assertThat(shouldSyncAfterSaturdayClose).isTrue();
    }

    @Test
    void effectiveExchangeRatesSyncUsesSevenAmSaturdayInStandardTime() {
        insertEffectiveExchangeRate(Instant.parse("2026-01-05T00:00:00Z"));
        insertSourceRun("MARKET_DATA_SYNC", "currencyStrength", "SUCCESS", Instant.parse("2026-01-03T00:10:00Z"));

        Boolean shouldSyncBeforeSaturdayClose = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "shouldSyncEffectiveExchangeRates",
            LocalDateTime.of(2026, 1, 10, 6, 59)
        );
        Boolean shouldSyncAfterSaturdayClose = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "shouldSyncEffectiveExchangeRates",
            LocalDateTime.of(2026, 1, 10, 7, 0)
        );

        assertThat(shouldSyncBeforeSaturdayClose).isFalse();
        assertThat(shouldSyncAfterSaturdayClose).isTrue();
    }

    @Test
    void effectiveExchangeRatesSyncRunsOnlyOnceForCompletedWeeklyWindow() {
        insertEffectiveExchangeRate(Instant.parse("2026-07-20T00:00:00Z"));
        insertSourceRun("MARKET_DATA_SYNC", "currencyStrength", "SUCCESS", Instant.parse("2026-07-24T21:10:00Z"));

        Boolean shouldSync = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "shouldSyncEffectiveExchangeRates",
            LocalDateTime.of(2026, 7, 27, 9, 0)
        );

        assertThat(shouldSync).isFalse();
    }

    @Test
    void effectiveExchangeRatesSyncCatchesUpMissedSaturdayRunOnStartup() {
        insertEffectiveExchangeRate(Instant.parse("2026-07-20T00:00:00Z"));
        insertSourceRun("MARKET_DATA_SYNC", "currencyStrength", "SUCCESS", Instant.parse("2026-07-18T00:10:00Z"));

        Boolean shouldSync = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "shouldSyncEffectiveExchangeRates",
            LocalDateTime.of(2026, 7, 27, 9, 0)
        );

        assertThat(shouldSync).isTrue();
    }

    @Test
    void effectiveExchangeRatesSyncDoesNotRepeatAfterSuccessfulEmptyInitialRun() {
        insertSourceRun("MARKET_DATA_SYNC", "currencyStrength", "SUCCESS", Instant.parse("2026-07-21T01:00:00Z"));

        Boolean shouldSync = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "shouldSyncEffectiveExchangeRates",
            LocalDateTime.of(2026, 7, 21, 10, 0)
        );

        assertThat(shouldSync).isFalse();
    }

    @Test
    void dollarIndexSyncRefreshesRecentOverlapEvenAfterTodayFetchAndBackfillsMissingRows() {
        FredClient fredClient = org.mockito.Mockito.mock(FredClient.class);
        marketDataSyncService = new MarketDataSyncService(properties(), syncProperties(), null, null, fredClient, null, null, null, null, jdbcTemplate);
        Instant todayFetch = Instant.now();
        insertDollarIndex("DTWEXBGS", LocalDate.of(2026, 7, 20), "130.000000", todayFetch);
        insertDollarIndex("DTWEXAFEGS", LocalDate.of(2026, 7, 20), "120.000000", todayFetch);
        when(fredClient.fetchObservations("DTWEXBGS", LocalDate.of(2026, 6, 20))).thenReturn(List.of(
            new FredClient.FredObservationPayload(LocalDate.of(2026, 7, 20), new BigDecimal("131.250000")),
            new FredClient.FredObservationPayload(LocalDate.of(2026, 7, 21), new BigDecimal("131.500000"))
        ));
        when(fredClient.fetchObservations("DTWEXAFEGS", LocalDate.of(2026, 6, 20))).thenReturn(List.of(
            new FredClient.FredObservationPayload(LocalDate.of(2026, 7, 20), new BigDecimal("121.250000")),
            new FredClient.FredObservationPayload(LocalDate.of(2026, 7, 21), new BigDecimal("121.500000"))
        ));

        Integer rows = ReflectionTestUtils.invokeMethod(marketDataSyncService, "syncDollarIndexes");

        assertThat(rows).isPositive();
        assertThat(countDollarIndexRows()).isEqualTo(4);
        assertThat(findDollarIndexValue("DTWEXBGS", LocalDate.of(2026, 7, 20))).isEqualByComparingTo("131.250000");
        assertThat(findDollarIndexValue("DTWEXBGS", LocalDate.of(2026, 7, 21))).isEqualByComparingTo("131.500000");
        assertThat(findDollarIndexValue("DTWEXAFEGS", LocalDate.of(2026, 7, 20))).isEqualByComparingTo("121.250000");
        assertThat(findDollarIndexValue("DTWEXAFEGS", LocalDate.of(2026, 7, 21))).isEqualByComparingTo("121.500000");
        verify(fredClient).fetchObservations("DTWEXBGS", LocalDate.of(2026, 6, 20));
        verify(fredClient).fetchObservations("DTWEXAFEGS", LocalDate.of(2026, 6, 20));
    }

    @Test
    void exchangeRateSyncUpdatesLatestDailyRatesFromKoreaeximEvenWhenFredReturnsRows() {
        FredClient fredClient = org.mockito.Mockito.mock(FredClient.class);
        KoreaeximExchangeClient koreaeximExchangeClient = org.mockito.Mockito.mock(KoreaeximExchangeClient.class);
        TwelveDataClient twelveDataClient = org.mockito.Mockito.mock(TwelveDataClient.class);
        marketDataSyncService = new MarketDataSyncService(properties(), syncProperties(), koreaeximExchangeClient, null, fredClient, twelveDataClient, null, null, null, jdbcTemplate);
        when(twelveDataClient.fetchCurrentExchangeRate(any())).thenReturn(java.util.Optional.empty());
        when(fredClient.fetchObservations(any(), any())).thenReturn(List.of());
        when(fredClient.fetchObservations(eq("DEXKOUS"), any())).thenReturn(List.of(
            new FredClient.FredObservationPayload(LocalDate.of(2026, 7, 24), new BigDecimal("1460.7600"))
        ));
        LocalDate koreaeximDate = LocalDate.now().minusDays(1);
        when(koreaeximExchangeClient.fetchExchangeRates(any(), any())).thenAnswer(invocation -> {
            LocalDate requestDate = invocation.getArgument(0);
            if (!koreaeximDate.equals(requestDate)) {
                return List.of();
            }
            return List.of(
                new KoreaeximExchangeClient.ExchangeRatePayload(koreaeximDate, "USD", "US Dollar", new BigDecimal("1390.1200")),
                new KoreaeximExchangeClient.ExchangeRatePayload(koreaeximDate, "EUR", "Euro", new BigDecimal("1605.3400"))
            );
        });

        Integer rows = ReflectionTestUtils.invokeMethod(marketDataSyncService, "syncExchangeRates");

        assertThat(rows).isEqualTo(3);
        assertThat(findExchangeRateDate("USD")).isEqualTo(koreaeximDate);
        assertThat(findExchangeRateValue("USD", koreaeximDate)).isEqualByComparingTo("1390.1200");
        assertThat(findExchangeRateDate("EUR")).isEqualTo(koreaeximDate);
        verify(koreaeximExchangeClient, atLeastOnce()).fetchExchangeRates(any(), any());
    }

    @Test
    void foreignReservesSyncStoresEcosThousandsOfDollarsAsMillionsOfDollars() {
        EcosClient ecosClient = org.mockito.Mockito.mock(EcosClient.class);
        marketDataSyncService = new MarketDataSyncService(properties(), syncProperties(), null, ecosClient, null, null, null, null, null, jdbcTemplate);
        when(ecosClient.fetchForeignReserves(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(List.of(
            new EcosClient.EcosObservationPayload(LocalDate.of(2026, 6, 30), new BigDecimal("410000000.0000"))
        ));

        Integer rows = ReflectionTestUtils.invokeMethod(marketDataSyncService, "syncForeignReserves");

        assertThat(rows).isEqualTo(1);
        BigDecimal storedValue = jdbcTemplate.queryForObject(
            "SELECT amount_usd_million FROM foreign_reserves WHERE base_date = ?",
            BigDecimal.class,
            LocalDate.of(2026, 6, 30)
        );
        assertThat(storedValue).isEqualByComparingTo("410000.0000");
    }

    @Test
    void m2SyncStoresEcosBillionsOfWonAsHundredMillionsOfWon() throws Exception {
        Class<?> specClass = Class.forName("com.example.krwwatcher.service.MarketDataSyncService$DomesticPolicySpec");
        var constructor = specClass.getDeclaredConstructor(String.class, String.class, String.class, String.class, String.class, String.class, String.class, BigDecimal.class);
        constructor.setAccessible(true);
        Object m2Spec = constructor.newInstance(
            "M2",
            "M2 통화량",
            "통화 정책",
            "161Y005",
            "BBHS00",
            "KRW_100M",
            "ECOS:161Y005",
            new BigDecimal("10")
        );

        Integer rows = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "upsertDomesticPolicyIndicators",
            m2Spec,
            List.of(new EcosClient.EcosObservationPayload(LocalDate.of(2026, 6, 30), new BigDecimal("4200000.0000")))
        );

        assertThat(rows).isEqualTo(1);
        BigDecimal storedValue = jdbcTemplate.queryForObject(
            "SELECT value FROM domestic_policy_indicators WHERE indicator_code = 'M2' AND base_date = ?",
            BigDecimal.class,
            LocalDate.of(2026, 6, 30)
        );
        assertThat(storedValue).isEqualByComparingTo("42000000.0000");
    }

    @Test
    void usdKrwBackfillSessionCooldownPreventsImmediateRetry() throws Exception {
        LocalDate sessionStartDate = LocalDate.of(2026, 7, 17);
        Instant attemptedAt = Instant.parse("2026-07-18T00:10:00Z");
        insertBackfillAttempt(
            "USD/KRW:2026-07-17",
            sessionStartDate,
            "NO_CHANGE",
            1,
            attemptedAt,
            attemptedAt.plus(Duration.ofHours(1))
        );

        Object decision = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "decideBackfillSession",
            sessionStartDate,
            syncTrigger("SCHEDULED_INTRADAY"),
            attemptedAt.plus(Duration.ofMinutes(5))
        );

        Boolean canAttempt = ReflectionTestUtils.invokeMethod(decision, "canAttempt");
        String status = ReflectionTestUtils.invokeMethod(decision, "status");
        Instant nextAllowedAt = ReflectionTestUtils.invokeMethod(decision, "nextAllowedAt");

        assertThat(canAttempt).isFalse();
        assertThat(status).isEqualTo("SKIPPED_SESSION_COOLDOWN");
        assertThat(nextAllowedAt).isEqualTo(attemptedAt.plus(Duration.ofHours(1)));
    }

    @Test
    void usdKrwBackfillNoChangeThresholdSuspendsScheduledRetryButManualCanBypass() throws Exception {
        LocalDate sessionStartDate = LocalDate.of(2026, 7, 17);
        Instant attemptedAt = Instant.parse("2026-07-18T00:10:00Z");
        insertBackfillAttempt(
            "USD/KRW:2026-07-17",
            sessionStartDate,
            "NO_CHANGE",
            3,
            attemptedAt,
            attemptedAt.minus(Duration.ofMinutes(1))
        );

        Object scheduledDecision = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "decideBackfillSession",
            sessionStartDate,
            syncTrigger("SCHEDULED_INTRADAY"),
            attemptedAt.plus(Duration.ofHours(2))
        );
        Object manualDecision = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "decideBackfillSession",
            sessionStartDate,
            syncTrigger("INTRADAY"),
            attemptedAt.plus(Duration.ofHours(2))
        );

        assertThat((Boolean) ReflectionTestUtils.invokeMethod(scheduledDecision, "canAttempt")).isFalse();
        assertThat((String) ReflectionTestUtils.invokeMethod(scheduledDecision, "status")).isEqualTo("SKIPPED_SESSION_SUSPENDED");
        assertThat((Boolean) ReflectionTestUtils.invokeMethod(manualDecision, "canAttempt")).isTrue();
    }

    private void insertSourceRun(String jobName, String sourceName, String status, Instant startedAt) {
        jdbcTemplate.update(
            """
                INSERT INTO batch_job_source_runs
                    (job_name, source_name, status, rows_processed, started_at, ended_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
            jobName,
            sourceName,
            status,
            "SUCCESS".equals(status) ? 1 : 0,
            startedAt,
            startedAt.plusSeconds(1)
        );
    }

    private void insertBackfillAttempt(String sessionKey, LocalDate sessionStartDate, String status, int noChangeCount, Instant attemptedAt, Instant nextAllowedAt) {
        jdbcTemplate.update(
            """
                INSERT INTO usd_krw_intraday_backfill_attempts
                    (session_key, currency_pair, session_start_date, status, rows_processed, previous_latest_observed_at, latest_observed_at, no_change_count, attempted_at, next_allowed_at, message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
            sessionKey,
            "USD/KRW",
            sessionStartDate,
            status,
            0,
            LocalDateTime.of(2026, 7, 18, 5, 40),
            LocalDateTime.of(2026, 7, 18, 5, 40),
            noChangeCount,
            attemptedAt,
            nextAllowedAt,
            "test"
        );
    }

    private void insertEffectiveExchangeRate(Instant fetchedAt) {
        jdbcTemplate.update(
            """
                INSERT INTO effective_exchange_rates
                    (base_date, area_code, area_name, index_type, basket_type, value, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
            LocalDate.of(2026, 6, 30),
            "KR",
            "Korea",
            "NEER",
            "BROAD",
            "100.000000",
            "BIS:WS_EER",
            fetchedAt
        );
    }

    private void insertDollarIndex(String seriesId, LocalDate baseDate, String value, Instant fetchedAt) {
        jdbcTemplate.update(
            """
                INSERT INTO dollar_indexes
                    (base_date, series_id, value, source, fetched_at)
                VALUES (?, ?, ?, ?, ?)
                """,
            baseDate,
            seriesId,
            value,
            "FRED",
            fetchedAt
        );
    }

    private BigDecimal findDollarIndexValue(String seriesId, LocalDate baseDate) {
        return jdbcTemplate.queryForObject(
            """
                SELECT value
                FROM dollar_indexes
                WHERE series_id = ?
                  AND base_date = ?
                """,
            BigDecimal.class,
            seriesId,
            baseDate
        );
    }

    private Integer countDollarIndexRows() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM dollar_indexes", Integer.class);
    }

    private LocalDate findExchangeRateDate(String currencyCode) {
        return jdbcTemplate.queryForObject(
            "SELECT MAX(base_date) FROM exchange_rates WHERE currency_code = ?",
            LocalDate.class,
            currencyCode
        );
    }

    private BigDecimal findExchangeRateValue(String currencyCode, LocalDate baseDate) {
        return jdbcTemplate.queryForObject(
            """
                SELECT deal_bas_rate
                FROM exchange_rates
                WHERE currency_code = ?
                  AND base_date = ?
                """,
            BigDecimal.class,
            currencyCode,
            baseDate
        );
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Object syncTrigger(String name) throws Exception {
        Class enumClass = Class.forName("com.example.krwwatcher.service.MarketDataSyncService$SyncTrigger");
        return Enum.valueOf(enumClass, name);
    }

    private SyncProperties syncProperties() {
        return new SyncProperties(new SyncProperties.Content(true), new SyncProperties.MarketData(
            true,
            Duration.ofMinutes(15),
            "",
            "Asia/Seoul",
            Duration.ofMinutes(5),
            "",
            Duration.ofHours(1),
            3,
            Duration.ofMinutes(30),
            "",
            new SyncProperties.SyncPostSecurity("test-admin-token", "", Duration.ofMinutes(15))
        ));
    }

    private ExternalApiProperties properties() {
        return new ExternalApiProperties(
            null,
            new ExternalApiProperties.Ecos("", "test-key", "722Y001", "0101000", "732Y001", "99"),
            new ExternalApiProperties.Fred(
                "",
                "test-key",
                "DTWEXBGS",
                "DTWEXAFEGS",
                "FEDFUNDS",
                "DEXKOUS",
                "DGS10",
                "VIXCLS",
                "DCOILWTICO",
                "BAMLH0A0HYM2"
            ),
            new ExternalApiProperties.TwelveData("", "test-key", "USD/KRW", "1min", 5000),
            null,
            null,
            null,
            null,
            null
        );
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:market-data-sync-run-state-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
