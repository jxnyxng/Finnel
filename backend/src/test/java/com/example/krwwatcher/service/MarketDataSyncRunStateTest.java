package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.function.IntSupplier;

import javax.sql.DataSource;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.example.krwwatcher.config.SyncProperties;
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
        marketDataSyncService = new MarketDataSyncService(properties(), syncProperties(), null, null, null, null, null, null, null, null, jdbcTemplate);
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

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Object syncTrigger(String name) throws Exception {
        Class enumClass = Class.forName("com.example.krwwatcher.service.MarketDataSyncService$SyncTrigger");
        return Enum.valueOf(enumClass, name);
    }

    private SyncProperties syncProperties() {
        return new SyncProperties(new SyncProperties.MarketData(
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
            null,
            null,
            new ExternalApiProperties.TwelveData("", "test-key", "USD/KRW", "1min", 5000),
            null,
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
        dataSource.setUrl("jdbc:h2:mem:market-data-sync-run-state-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
