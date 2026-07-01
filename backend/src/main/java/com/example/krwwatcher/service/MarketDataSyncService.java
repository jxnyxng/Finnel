package com.example.krwwatcher.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.Duration;
import java.time.DayOfWeek;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.IntSupplier;
import java.util.concurrent.locks.ReentrantLock;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.example.krwwatcher.config.SyncProperties;
import com.example.krwwatcher.external.EcosClient;
import com.example.krwwatcher.external.FredClient;
import com.example.krwwatcher.external.KoreaeximExchangeClient;
import com.example.krwwatcher.external.TwelveDataClient;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MarketDataSyncService {

    private static final String JOB_NAME = "MARKET_DATA_SYNC";
    private static final String INTRADAY_JOB_NAME = "INTRADAY_EXCHANGE_SYNC";
    private static final String DAILY_BACKFILL_JOB_NAME = "DAILY_EXCHANGE_BACKFILL_SYNC";

    private final ExternalApiProperties properties;
    private final SyncProperties syncProperties;
    private final KoreaeximExchangeClient koreaeximExchangeClient;
    private final EcosClient ecosClient;
    private final FredClient fredClient;
    private final TwelveDataClient twelveDataClient;
    private final JdbcTemplate jdbcTemplate;
    private final ReentrantLock syncLock = new ReentrantLock();
    private final ReentrantLock intradaySyncLock = new ReentrantLock();
    private final ReentrantLock dailyBackfillLock = new ReentrantLock();

    public MarketDataSyncService(
        ExternalApiProperties properties,
        SyncProperties syncProperties,
        KoreaeximExchangeClient koreaeximExchangeClient,
        EcosClient ecosClient,
        FredClient fredClient,
        TwelveDataClient twelveDataClient,
        JdbcTemplate jdbcTemplate
    ) {
        this.properties = properties;
        this.syncProperties = syncProperties;
        this.koreaeximExchangeClient = koreaeximExchangeClient;
        this.ecosClient = ecosClient;
        this.fredClient = fredClient;
        this.twelveDataClient = twelveDataClient;
        this.jdbcTemplate = jdbcTemplate;
    }

    public SyncResult requestManualSync() {
        Instant now = Instant.now();
        SyncWindow syncWindow = currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), now);
        if (!syncWindow.canSync()) {
            return skipped("SKIPPED_COOLDOWN", "Manual sync cooldown is active", SyncTrigger.MANUAL, syncWindow);
        }

        return syncNow(SyncTrigger.MANUAL);
    }

    public SyncResult requestIntradayRefresh() {
        Instant now = Instant.now();
        SyncWindow syncWindow = currentSyncWindow(INTRADAY_JOB_NAME, syncProperties.marketData().intradayCooldown(), now);
        if (!syncWindow.canSync()) {
            return skipped("SKIPPED_COOLDOWN", "Intraday sync cooldown is active", SyncTrigger.INTRADAY, syncWindow);
        }

        return syncIntradayNow(SyncTrigger.INTRADAY);
    }

    public SyncResult requestDailyBackfill() {
        Instant now = Instant.now();
        SyncWindow syncWindow = currentSyncWindow(DAILY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), now);
        if (!syncWindow.canSync()) {
            return skipped("SKIPPED_COOLDOWN", "Daily exchange backfill cooldown is active", SyncTrigger.DAILY_BACKFILL, syncWindow);
        }

        return syncDailyBackfillNow(SyncTrigger.DAILY_BACKFILL);
    }

    @Scheduled(cron = "${app.sync.market-data.cron}", zone = "${app.sync.market-data.zone}")
    public void scheduledSync() {
        if (!syncProperties.marketData().enabled()) {
            return;
        }

        Instant now = Instant.now();
        if (currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), now).canSync()) {
            syncNow(SyncTrigger.SCHEDULED);
        }
    }

    @Scheduled(cron = "${app.sync.market-data.intraday-cron}", zone = "${app.sync.market-data.zone}")
    public void scheduledIntradaySync() {
        if (!syncProperties.marketData().enabled()) {
            return;
        }

        Instant now = Instant.now();
        if (currentSyncWindow(INTRADAY_JOB_NAME, syncProperties.marketData().intradayCooldown(), now).canSync()) {
            syncIntradayNow(SyncTrigger.SCHEDULED_INTRADAY);
        }
    }

    @Scheduled(cron = "${app.sync.market-data.daily-backfill-cron}", zone = "${app.sync.market-data.zone}")
    public void scheduledDailyBackfill() {
        if (!syncProperties.marketData().enabled()) {
            return;
        }

        Instant now = Instant.now();
        if (currentSyncWindow(DAILY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), now).canSync()) {
            syncDailyBackfillNow(SyncTrigger.SCHEDULED_DAILY_BACKFILL);
        }
    }

    public SyncStatus status() {
        SyncWindow syncWindow = currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), Instant.now());
        LatestJob latestJob = findLatestJob(JOB_NAME);
        return new SyncStatus(
            latestJob == null ? null : latestJob.status(),
            latestJob == null ? null : latestJob.startedAt(),
            latestJob == null ? null : latestJob.endedAt(),
            latestJob == null ? null : latestJob.message(),
            syncWindow.nextAllowedAt(),
            syncWindow.remainingCooldownSeconds(),
            syncWindow.canSync() && !syncLock.isLocked()
        );
    }

    public SyncStatus intradayStatus() {
        SyncWindow syncWindow = currentSyncWindow(INTRADAY_JOB_NAME, syncProperties.marketData().intradayCooldown(), Instant.now());
        LatestJob latestJob = findLatestJob(INTRADAY_JOB_NAME);
        return new SyncStatus(
            latestJob == null ? null : latestJob.status(),
            latestJob == null ? null : latestJob.startedAt(),
            latestJob == null ? null : latestJob.endedAt(),
            latestJob == null ? null : latestJob.message(),
            syncWindow.nextAllowedAt(),
            syncWindow.remainingCooldownSeconds(),
            syncWindow.canSync() && !intradaySyncLock.isLocked()
        );
    }

    public SyncStatus dailyBackfillStatus() {
        SyncWindow syncWindow = currentSyncWindow(DAILY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), Instant.now());
        LatestJob latestJob = findLatestJob(DAILY_BACKFILL_JOB_NAME);
        return new SyncStatus(
            latestJob == null ? null : latestJob.status(),
            latestJob == null ? null : latestJob.startedAt(),
            latestJob == null ? null : latestJob.endedAt(),
            latestJob == null ? null : latestJob.message(),
            syncWindow.nextAllowedAt(),
            syncWindow.remainingCooldownSeconds(),
            syncWindow.canSync() && !dailyBackfillLock.isLocked()
        );
    }

    private SyncResult syncNow(SyncTrigger trigger) {
        if (!syncLock.tryLock()) {
            return skipped("SKIPPED_RUNNING", "Market data sync is already running", trigger, currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), Instant.now()));
        }

        try {
            return runSync(trigger);
        } finally {
            syncLock.unlock();
        }
    }

    private SyncResult syncIntradayNow(SyncTrigger trigger) {
        if (!intradaySyncLock.tryLock()) {
            return skipped("SKIPPED_RUNNING", "Intraday sync is already running", trigger, currentSyncWindow(INTRADAY_JOB_NAME, syncProperties.marketData().intradayCooldown(), Instant.now()));
        }

        try {
            return runIntradaySync(trigger);
        } finally {
            intradaySyncLock.unlock();
        }
    }

    private SyncResult syncDailyBackfillNow(SyncTrigger trigger) {
        if (!dailyBackfillLock.tryLock()) {
            return skipped("SKIPPED_RUNNING", "Daily exchange backfill is already running", trigger, currentSyncWindow(DAILY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), Instant.now()));
        }

        try {
            return runDailyBackfill(trigger);
        } finally {
            dailyBackfillLock.unlock();
        }
    }

    @Transactional
    protected SyncResult runSync(SyncTrigger trigger) {
        Instant startedAt = Instant.now();
        Long jobId = startJob(JOB_NAME, startedAt, trigger);
        SyncCounter counter = new SyncCounter();

        int exchangeRows = runSource("exchange", counter, this::syncUsdKrw);
        int dailyBackfillRows = runSource("dailyBackfill", counter, this::syncUsdKrwDailyBackfill);
        int intradayExchangeRows = runSource("intradayExchange", counter, this::syncUsdKrwIntraday);
        int dollarIndexRows = runSource("dollarIndex", counter, this::syncDollarIndex);
        int usRateRows = runSource("usRate", counter, this::syncUsPolicyRate);
        int krRateRows = runSource("krRate", counter, this::syncKoreanPolicyRate);
        int foreignReserveRows = runSource("foreignReserve", counter, this::syncForeignReserves);

        String status = counter.failures == 0 ? "SUCCESS" : "PARTIAL_SUCCESS";
        String message = "exchange=" + exchangeRows + ", dailyBackfill=" + dailyBackfillRows + ", intradayExchange=" + intradayExchangeRows + ", dollarIndex=" + dollarIndexRows + ", usRate=" + usRateRows + ", krRate=" + krRateRows + ", foreignReserve=" + foreignReserveRows + counter.message;
        finishJob(jobId, status, Instant.now(), message);
        SyncWindow syncWindow = currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), Instant.now());
        return new SyncResult(exchangeRows + dailyBackfillRows, intradayExchangeRows, dollarIndexRows, usRateRows, krRateRows, foreignReserveRows, status, message, trigger.name(), startedAt, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    @Transactional
    protected SyncResult runIntradaySync(SyncTrigger trigger) {
        Instant startedAt = Instant.now();
        Long jobId = startJob(INTRADAY_JOB_NAME, startedAt, trigger);
        SyncCounter counter = new SyncCounter();

        int intradayExchangeRows = runSource("intradayExchange", counter, this::syncUsdKrwIntraday);

        String status = counter.failures == 0 ? "SUCCESS" : "PARTIAL_SUCCESS";
        String message = "intradayExchange=" + intradayExchangeRows + counter.message;
        finishJob(jobId, status, Instant.now(), message);
        SyncWindow syncWindow = currentSyncWindow(INTRADAY_JOB_NAME, syncProperties.marketData().intradayCooldown(), Instant.now());
        return new SyncResult(0, intradayExchangeRows, 0, 0, 0, 0, status, message, trigger.name(), startedAt, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    @Transactional
    protected SyncResult runDailyBackfill(SyncTrigger trigger) {
        Instant startedAt = Instant.now();
        Long jobId = startJob(DAILY_BACKFILL_JOB_NAME, startedAt, trigger);
        SyncCounter counter = new SyncCounter();

        int exchangeRows = runSource("dailyBackfill", counter, this::syncUsdKrwDailyBackfill);

        String status = counter.failures == 0 ? "SUCCESS" : "PARTIAL_SUCCESS";
        String message = "dailyBackfill=" + exchangeRows + counter.message;
        finishJob(jobId, status, Instant.now(), message);
        SyncWindow syncWindow = currentSyncWindow(DAILY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), Instant.now());
        return new SyncResult(exchangeRows, 0, 0, 0, 0, 0, status, message, trigger.name(), startedAt, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    private int runSource(String sourceName, SyncCounter counter, IntSupplier supplier) {
        try {
            return supplier.getAsInt();
        } catch (RuntimeException exception) {
            counter.failures++;
            counter.message += ", " + sourceName + "Error=" + exception.getClass().getSimpleName();
            return 0;
        }
    }

    private int syncUsdKrw() {
        try {
            return koreaeximExchangeClient.fetchLatestUsdKrw(LocalDate.now())
                .map(payload -> jdbcTemplate.update("""
                    INSERT INTO exchange_rates (base_date, currency_code, currency_name, deal_bas_rate, source, fetched_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        currency_name = VALUES(currency_name),
                        deal_bas_rate = VALUES(deal_bas_rate),
                        source = VALUES(source),
                        fetched_at = VALUES(fetched_at)
                    """,
                payload.baseDate(),
                payload.currencyCode(),
                payload.currencyName(),
                payload.dealBasRate(),
                "KOREAEXIM",
                    Instant.now()
                ))
                .orElseGet(this::syncUsdKrwFromTwelveDataDaily);
        } catch (RuntimeException exception) {
            return syncUsdKrwFromTwelveDataDaily();
        }
    }

    private int syncUsdKrwFromTwelveDataDaily() {
        List<TwelveDataClient.DailyExchangePayload> observations = twelveDataClient.fetchUsdKrwDaily();
        if (observations.isEmpty()) {
            return syncUsdKrwFromFred();
        }

        return upsertDailyUsdKrwFromTwelveData(observations);
    }

    private int syncUsdKrwDailyBackfill() {
        List<TwelveDataClient.DailyExchangePayload> observations = twelveDataClient.fetchUsdKrwDaily();
        if (!observations.isEmpty()) {
            int rows = upsertDailyUsdKrwFromTwelveData(observations);
            return rows + backfillMissingWeekdaysFromIntraday();
        }

        return syncUsdKrwFromFred();
    }

    private int upsertDailyUsdKrwFromTwelveData(List<TwelveDataClient.DailyExchangePayload> observations) {
        return observations.stream()
            .filter(payload -> isWeekday(payload.baseDate()))
            .mapToInt(payload -> upsertDailyUsdKrw(payload.baseDate(), payload.closeRate(), "TWELVE_DATA:1day"))
            .sum();
    }

    private int backfillMissingWeekdaysFromIntraday() {
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(14);
        LocalDate endDate = today.minusDays(1);
        Set<LocalDate> existingDates = new HashSet<>(findDailyUsdKrwDates(startDate, endDate));
        int rows = 0;
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            if (!isWeekday(date) || existingDates.contains(date)) {
                continue;
            }

            LocalDate missingDate = date;
            rows += findLatestIntradayClose(missingDate)
                .map(value -> upsertDailyUsdKrw(missingDate, value, "TWELVE_DATA:5min:CLOSE"))
                .orElse(0);
        }

        return rows;
    }

    private int upsertDailyUsdKrw(LocalDate baseDate, java.math.BigDecimal rate, String source) {
        return jdbcTemplate.update("""
                INSERT INTO exchange_rates (base_date, currency_code, currency_name, deal_bas_rate, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    currency_name = VALUES(currency_name),
                    deal_bas_rate = VALUES(deal_bas_rate),
                    source = VALUES(source),
                    fetched_at = VALUES(fetched_at)
                """,
            baseDate,
            "USD",
            "US Dollar",
            rate,
            source,
            Instant.now()
        );
    }

    private int syncUsdKrwFromFred() {
        String seriesId = properties.fred().usdKrwSeriesId();
        List<FredClient.FredObservationPayload> observations = fredClient.fetchObservations(seriesId, LocalDate.now().minusYears(5));
        return observations.stream()
            .mapToInt(payload -> jdbcTemplate.update("""
                    INSERT INTO exchange_rates (base_date, currency_code, currency_name, deal_bas_rate, source, fetched_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        currency_name = VALUES(currency_name),
                        deal_bas_rate = VALUES(deal_bas_rate),
                        source = VALUES(source),
                        fetched_at = VALUES(fetched_at)
                    """,
                payload.baseDate(),
                "USD",
                "US Dollar",
                payload.value(),
                "FRED:" + seriesId,
                Instant.now()
            ))
            .sum();
    }

    private LocalDate findLatestDailyUsdKrwDate() {
        return jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM exchange_rates
                WHERE currency_code = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            "USD"
        ).stream().findFirst().orElse(null);
    }

    private List<LocalDate> findDailyUsdKrwDates(LocalDate startDate, LocalDate endDate) {
        return jdbcTemplate.query(
            """
                SELECT base_date
                FROM exchange_rates
                WHERE currency_code = ?
                  AND base_date BETWEEN ? AND ?
                """,
            (rs, rowNum) -> rs.getDate("base_date").toLocalDate(),
            "USD",
            startDate,
            endDate
        );
    }

    private java.util.Optional<java.math.BigDecimal> findLatestIntradayClose(LocalDate date) {
        return jdbcTemplate.query(
            """
                SELECT close_rate
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                  AND DATE(observed_at) = ?
                ORDER BY observed_at DESC
                LIMIT 1
                """,
            (rs, rowNum) -> rs.getBigDecimal("close_rate"),
            properties.twelveData().usdKrwSymbol(),
            date
        ).stream().findFirst();
    }

    private boolean isWeekday(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        return dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY;
    }

    private int syncDollarIndex() {
        String seriesId = properties.fred().dollarIndexSeriesId();
        List<FredClient.FredObservationPayload> observations = fredClient.fetchObservations(seriesId, LocalDate.now().minusYears(5));
        return observations.stream()
            .mapToInt(payload -> jdbcTemplate.update("""
                    INSERT INTO dollar_indexes (base_date, series_id, value, source, fetched_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        value = VALUES(value),
                        source = VALUES(source),
                        fetched_at = VALUES(fetched_at)
                    """,
                payload.baseDate(),
                seriesId,
                payload.value(),
                "FRED",
                Instant.now()
            ))
            .sum();
    }

    private int syncUsdKrwIntraday() {
        List<TwelveDataClient.IntradayExchangePayload> observations = twelveDataClient.fetchUsdKrwIntraday();
        return observations.stream()
            .mapToInt(payload -> jdbcTemplate.update("""
                    INSERT INTO intraday_exchange_rates (observed_at, currency_pair, close_rate, source, fetched_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        close_rate = VALUES(close_rate),
                        source = VALUES(source),
                        fetched_at = VALUES(fetched_at)
                    """,
                payload.observedAt(),
                payload.currencyPair(),
                payload.closeRate(),
                "TWELVE_DATA",
                Instant.now()
            ))
            .sum();
    }

    private int syncUsPolicyRate() {
        String seriesId = properties.fred().usPolicyRateSeriesId();
        List<FredClient.FredObservationPayload> observations = fredClient.fetchObservations(seriesId, LocalDate.now().minusYears(1));
        return observations.stream()
            .mapToInt(payload -> jdbcTemplate.update("""
                    INSERT INTO interest_rates (base_date, country_code, rate_type, rate_value, source, fetched_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        rate_value = VALUES(rate_value),
                        source = VALUES(source),
                        fetched_at = VALUES(fetched_at)
                    """,
                payload.baseDate(),
                "US",
                "POLICY_RATE",
                payload.value(),
                "FRED:" + seriesId,
                Instant.now()
            ))
            .sum();
    }

    private int syncKoreanPolicyRate() {
        List<EcosClient.EcosObservationPayload> observations = ecosClient.fetchKoreanPolicyRates(LocalDate.now().minusYears(1), LocalDate.now());
        return observations.stream()
            .mapToInt(payload -> jdbcTemplate.update("""
                    INSERT INTO interest_rates (base_date, country_code, rate_type, rate_value, source, fetched_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        rate_value = VALUES(rate_value),
                        source = VALUES(source),
                        fetched_at = VALUES(fetched_at)
                    """,
                payload.baseDate(),
                "KR",
                "POLICY_RATE",
                payload.value(),
                "ECOS:" + properties.ecos().koreanPolicyRateStatCode(),
                Instant.now()
            ))
            .sum();
    }

    private int syncForeignReserves() {
        YearMonth currentMonth = YearMonth.now();
        List<EcosClient.EcosObservationPayload> observations = ecosClient.fetchForeignReserves(currentMonth.minusYears(5), currentMonth);
        return observations.stream()
            .mapToInt(payload -> jdbcTemplate.update("""
                    INSERT INTO foreign_reserves (base_date, amount_usd_million, source, fetched_at)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        amount_usd_million = VALUES(amount_usd_million),
                        source = VALUES(source),
                        fetched_at = VALUES(fetched_at)
                    """,
                payload.baseDate(),
                payload.value(),
                "ECOS:" + properties.ecos().foreignReservesStatCode(),
                Instant.now()
            ))
            .sum();
    }

    private Long startJob(String jobName, Instant startedAt, SyncTrigger trigger) {
        jdbcTemplate.update(
            "INSERT INTO batch_job_runs (job_name, status, started_at, message) VALUES (?, ?, ?, ?)",
            jobName,
            "RUNNING",
            startedAt,
            trigger.name() + " sync started"
        );
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    private void finishJob(Long jobId, String status, Instant endedAt, String message) {
        jdbcTemplate.update(
            "UPDATE batch_job_runs SET status = ?, ended_at = ?, message = ? WHERE id = ?",
            status,
            endedAt,
            message,
            jobId
        );
    }

    private SyncResult skipped(String status, String message, SyncTrigger trigger, SyncWindow syncWindow) {
        return new SyncResult(0, 0, 0, 0, 0, 0, status, message, trigger.name(), null, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    private SyncWindow currentSyncWindow(String jobName, Duration cooldown, Instant now) {
        Instant lastStartedAt = findLatestStartedAt(jobName);
        if (lastStartedAt == null) {
            return new SyncWindow(null, 0, true);
        }

        Instant nextAllowedAt = lastStartedAt.plus(cooldown);
        long remainingSeconds = Math.max(0, Duration.between(now, nextAllowedAt).getSeconds());
        return new SyncWindow(nextAllowedAt, remainingSeconds, remainingSeconds == 0);
    }

    private Instant findLatestStartedAt(String jobName) {
        return jdbcTemplate.query(
            """
                SELECT started_at
                FROM batch_job_runs
                WHERE job_name = ?
                  AND status IN ('RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS')
                ORDER BY started_at DESC
                LIMIT 1
            """,
            (rs, rowNum) -> rs.getTimestamp("started_at").toInstant(),
            jobName
        ).stream().findFirst().orElse(null);
    }

    private LatestJob findLatestJob(String jobName) {
        return jdbcTemplate.query(
            """
                SELECT status, started_at, ended_at, message
                FROM batch_job_runs
                WHERE job_name = ?
                ORDER BY started_at DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new LatestJob(
                rs.getString("status"),
                rs.getTimestamp("started_at").toInstant(),
                rs.getTimestamp("ended_at") == null ? null : rs.getTimestamp("ended_at").toInstant(),
                rs.getString("message")
            ),
            jobName
        ).stream().findFirst().orElse(null);
    }

    private static class SyncCounter {
        private int failures;
        private String message = "";
    }

    private enum SyncTrigger {
        MANUAL,
        SCHEDULED,
        INTRADAY,
        SCHEDULED_INTRADAY,
        DAILY_BACKFILL,
        SCHEDULED_DAILY_BACKFILL
    }

    private record SyncWindow(Instant nextAllowedAt, long remainingCooldownSeconds, boolean canSync) {
    }

    private record LatestJob(String status, Instant startedAt, Instant endedAt, String message) {
    }

    public record SyncResult(
        int exchangeRateRows,
        int intradayExchangeRateRows,
        int dollarIndexRows,
        int usPolicyRateRows,
        int krPolicyRateRows,
        int foreignReserveRows,
        String status,
        String message,
        String trigger,
        Instant startedAt,
        Instant nextAllowedAt,
        long remainingCooldownSeconds
    ) {
    }

    public record SyncStatus(
        String latestStatus,
        Instant latestStartedAt,
        Instant latestEndedAt,
        String latestMessage,
        Instant nextAllowedAt,
        long remainingCooldownSeconds,
        boolean canSync
    ) {
    }
}
