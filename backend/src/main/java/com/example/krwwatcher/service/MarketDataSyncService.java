package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.NavigableMap;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.IntSupplier;
import java.util.concurrent.locks.ReentrantLock;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.example.krwwatcher.config.SyncProperties;
import com.example.krwwatcher.external.BisClient;
import com.example.krwwatcher.external.BokPortalClient;
import com.example.krwwatcher.external.EcosClient;
import com.example.krwwatcher.external.FredClient;
import com.example.krwwatcher.external.KoreaeximExchangeClient;
import com.example.krwwatcher.external.OpenFiscalClient;
import com.example.krwwatcher.external.TwelveDataClient;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MarketDataSyncService {

    private static final String JOB_NAME = "MARKET_DATA_SYNC";
    private static final String INTRADAY_JOB_NAME = "INTRADAY_EXCHANGE_SYNC";
    private static final String USD_KRW_BACKFILL_STATUS_BACKFILLED = "BACKFILLED";
    private static final String USD_KRW_BACKFILL_STATUS_NO_CHANGE = "NO_CHANGE";
    private static final String USD_KRW_BACKFILL_STATUS_SKIPPED_COOLDOWN = "SKIPPED_SESSION_COOLDOWN";
    private static final String USD_KRW_BACKFILL_STATUS_SKIPPED_SUSPENDED = "SKIPPED_SESSION_SUSPENDED";
    private static final String DAILY_BACKFILL_JOB_NAME = "DAILY_EXCHANGE_BACKFILL_SYNC";
    private static final String EXCHANGE_RATE_HISTORY_BACKFILL_JOB_NAME = "EXCHANGE_RATE_HISTORY_BACKFILL_SYNC";
    private static final String CURRENT_EXCHANGE_RATE_JOB_NAME = "CURRENT_EXCHANGE_RATE_SYNC";
    private static final LocalDate EXCHANGE_RATE_HISTORY_START_DATE = LocalDate.of(1999, 1, 1);
    private static final int DOLLAR_INDEX_REFRESH_OVERLAP_DAYS = 30;
    private static final int RECENT_MONTH_REFRESH_OVERLAP = 6;
    private static final int RECENT_QUARTER_REFRESH_MONTH_OVERLAP = 12;
    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final Set<String> MAJOR_EXCHANGE_RATE_PREFIXES = Set.of(
        "USD",
        "JPY",
        "EUR",
        "CNH",
        "CNY",
        "GBP",
        "AUD",
        "CAD",
        "CHF",
        "HKD",
        "SGD"
    );
    private static final int CURRENT_EXCHANGE_RATE_BATCH_SIZE = 4;
    private static final Duration CURRENT_EXCHANGE_RATE_STALE_AFTER = Duration.ofMinutes(60);
    private static final Duration STALE_RUNNING_TTL = Duration.ofHours(2);
    private static final Set<String> CORE_SOURCE_NAMES = Set.of(
        "exchange",
        "intradayExchange",
        "dollarIndex",
        "currencyStrength",
        "usRate",
        "krRate",
        "foreignReserve",
        "domesticPolicy",
        "currentExchange",
        "dailyBackfill",
        "exchangeRateHistoryBackfill"
    );

    private final ExternalApiProperties properties;
    private final SyncProperties syncProperties;
    private final KoreaeximExchangeClient koreaeximExchangeClient;
    private final EcosClient ecosClient;
    private final FredClient fredClient;
    private final TwelveDataClient twelveDataClient;
    private final BisClient bisClient;
    private final OpenFiscalClient openFiscalClient;
    private final BokPortalClient bokPortalClient;
    private final BusinessDayService businessDayService;
    private final JdbcTemplate jdbcTemplate;
    private final ReentrantLock syncLock = new ReentrantLock();
    private final ReentrantLock intradaySyncLock = new ReentrantLock();
    private final ReentrantLock dailyBackfillLock = new ReentrantLock();
    private final ReentrantLock exchangeRateHistoryBackfillLock = new ReentrantLock();
    private final ReentrantLock currentExchangeRateLock = new ReentrantLock();

    public MarketDataSyncService(
        ExternalApiProperties properties,
        SyncProperties syncProperties,
        KoreaeximExchangeClient koreaeximExchangeClient,
        EcosClient ecosClient,
        FredClient fredClient,
        TwelveDataClient twelveDataClient,
        BisClient bisClient,
        OpenFiscalClient openFiscalClient,
        BokPortalClient bokPortalClient,
        BusinessDayService businessDayService,
        JdbcTemplate jdbcTemplate
    ) {
        this.properties = properties;
        this.syncProperties = syncProperties;
        this.koreaeximExchangeClient = koreaeximExchangeClient;
        this.ecosClient = ecosClient;
        this.fredClient = fredClient;
        this.twelveDataClient = twelveDataClient;
        this.bisClient = bisClient;
        this.openFiscalClient = openFiscalClient;
        this.bokPortalClient = bokPortalClient;
        this.businessDayService = businessDayService;
        this.jdbcTemplate = jdbcTemplate;
    }

    public SyncResult requestManualSync() {
        Instant now = Instant.now();
        SyncWindow syncWindow = currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), now);
        if (!syncWindow.canSync() && !hasRetryableFailedCoreSource(JOB_NAME, syncProperties.marketData().manualCooldown(), now)) {
            return skipped("SKIPPED_COOLDOWN", "Manual sync cooldown is active", SyncTrigger.MANUAL, syncWindow);
        }

        return syncNow(SyncTrigger.MANUAL);
    }

    public SyncResult requestIntradayRefresh() {
        Instant now = Instant.now();
        SyncWindow syncWindow = currentSyncWindow(INTRADAY_JOB_NAME, syncProperties.marketData().intradayCooldown(), now);
        if (!shouldRunIntradaySyncNow(SyncTrigger.INTRADAY)) {
            return skipped("SKIPPED_NON_BUSINESS_DAY", "Intraday sync runs only during USD/KRW trading sessions or while backfill is needed", SyncTrigger.INTRADAY, syncWindow);
        }
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

    public SyncResult requestExchangeRateHistoryBackfill() {
        Instant now = Instant.now();
        SyncWindow syncWindow = currentSyncWindow(EXCHANGE_RATE_HISTORY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), now);
        if (!syncWindow.canSync()) {
            return skipped("SKIPPED_COOLDOWN", "Exchange rate history backfill cooldown is active", SyncTrigger.EXCHANGE_RATE_HISTORY_BACKFILL, syncWindow);
        }

        return syncExchangeRateHistoryBackfillNow(SyncTrigger.EXCHANGE_RATE_HISTORY_BACKFILL);
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
        if (!shouldRunIntradaySyncNow(SyncTrigger.SCHEDULED_INTRADAY)) {
            return;
        }

        Instant now = Instant.now();
        if (currentSyncWindow(INTRADAY_JOB_NAME, syncProperties.marketData().intradayCooldown(), now).canSync()) {
            syncIntradayNow(SyncTrigger.SCHEDULED_INTRADAY);
        }
    }

    @Scheduled(cron = "0 */15 * * * *", zone = "${app.sync.market-data.zone}")
    public void scheduledCurrentExchangeRateSync() {
        if (!syncProperties.marketData().enabled()) {
            return;
        }

        syncCurrentExchangeRatesNow(SyncTrigger.SCHEDULED_CURRENT_EXCHANGE);
    }

    @Scheduled(cron = "${app.sync.market-data.currency-strength-cron}", zone = "${app.sync.market-data.zone}")
    public void scheduledCurrencyStrengthSync() {
        if (!syncProperties.marketData().enabled()) {
            return;
        }

        Instant now = Instant.now();
        if (currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), now).canSync()) {
            syncCurrencyStrengthNow(SyncTrigger.SCHEDULED_CURRENCY_STRENGTH);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    @Async("startupSyncExecutor")
    public void syncOnStartup() {
        if (!syncProperties.marketData().enabled()) {
            return;
        }

        Instant now = Instant.now();
        syncCurrentExchangeRatesNow(SyncTrigger.SCHEDULED_CURRENT_EXCHANGE);

        if (currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), now).canSync()) {
            syncNow(SyncTrigger.SCHEDULED);
        }

        if (currentSyncWindow(DAILY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), Instant.now()).canSync()) {
            syncDailyBackfillNow(SyncTrigger.SCHEDULED_DAILY_BACKFILL);
        }

        if (!shouldRunIntradaySyncNow(SyncTrigger.SCHEDULED_INTRADAY)) {
            return;
        }

        if (currentSyncWindow(INTRADAY_JOB_NAME, syncProperties.marketData().intradayCooldown(), Instant.now()).canSync()) {
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
            syncWindow.canSync() && !syncLock.isLocked(),
            latestJob == null ? List.of() : findLatestSourceRuns(JOB_NAME, latestJob.startedAt()),
            null,
            findHolidayCalendarStatuses()
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
            syncWindow.canSync() && !intradaySyncLock.isLocked(),
            latestJob == null ? List.of() : findLatestSourceRuns(INTRADAY_JOB_NAME, latestJob.startedAt()),
            findLatestUsdKrwBackfillAttempt(),
            findHolidayCalendarStatuses()
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
            syncWindow.canSync() && !dailyBackfillLock.isLocked(),
            latestJob == null ? List.of() : findLatestSourceRuns(DAILY_BACKFILL_JOB_NAME, latestJob.startedAt()),
            null,
            findHolidayCalendarStatuses()
        );
    }

    public SyncStatus exchangeRateHistoryBackfillStatus() {
        SyncWindow syncWindow = currentSyncWindow(EXCHANGE_RATE_HISTORY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), Instant.now());
        LatestJob latestJob = findLatestJob(EXCHANGE_RATE_HISTORY_BACKFILL_JOB_NAME);
        return new SyncStatus(
            latestJob == null ? null : latestJob.status(),
            latestJob == null ? null : latestJob.startedAt(),
            latestJob == null ? null : latestJob.endedAt(),
            latestJob == null ? null : latestJob.message(),
            syncWindow.nextAllowedAt(),
            syncWindow.remainingCooldownSeconds(),
            syncWindow.canSync() && !exchangeRateHistoryBackfillLock.isLocked(),
            latestJob == null ? List.of() : findLatestSourceRuns(EXCHANGE_RATE_HISTORY_BACKFILL_JOB_NAME, latestJob.startedAt()),
            null,
            findHolidayCalendarStatuses()
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

    private SyncResult syncCurrencyStrengthNow(SyncTrigger trigger) {
        if (!syncLock.tryLock()) {
            return skipped("SKIPPED_RUNNING", "Market data sync is already running", trigger, currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), Instant.now()));
        }

        try {
            return runCurrencyStrengthSync(trigger);
        } finally {
            syncLock.unlock();
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

    private SyncResult syncExchangeRateHistoryBackfillNow(SyncTrigger trigger) {
        if (!exchangeRateHistoryBackfillLock.tryLock()) {
            return skipped("SKIPPED_RUNNING", "Exchange rate history backfill is already running", trigger, currentSyncWindow(EXCHANGE_RATE_HISTORY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), Instant.now()));
        }

        try {
            return runExchangeRateHistoryBackfill(trigger);
        } finally {
            exchangeRateHistoryBackfillLock.unlock();
        }
    }

    private SyncResult syncCurrentExchangeRatesNow(SyncTrigger trigger) {
        if (!currentExchangeRateLock.tryLock()) {
            return skipped("SKIPPED_RUNNING", "Current exchange rate sync is already running", trigger, new SyncWindow(null, 0, true));
        }

        try {
            return runCurrentExchangeRateSync(trigger);
        } finally {
            currentExchangeRateLock.unlock();
        }
    }

    @Transactional
    protected SyncResult runSync(SyncTrigger trigger) {
        Instant startedAt = Instant.now();
        Long jobId = startJob(JOB_NAME, startedAt, trigger);
        SyncCounter counter = new SyncCounter();

        int exchangeRows = runSource(jobId, JOB_NAME, "exchange", counter, syncProperties.marketData().manualCooldown(), this::syncExchangeRates);
        int dailyBackfillRows = runSource(jobId, JOB_NAME, "dailyBackfill", counter, syncProperties.marketData().manualCooldown(), this::backfillMissingWeekdaysFromIntraday);
        int intradayExchangeRows = 0;
        int dollarIndexRows = runSource(jobId, JOB_NAME, "dollarIndex", counter, syncProperties.marketData().manualCooldown(), this::syncDollarIndexes);
        int currencyStrengthRows = runSource(jobId, JOB_NAME, "currencyStrength", counter, syncProperties.marketData().manualCooldown(), this::syncEffectiveExchangeRates);
        int usRateRows = runSource(jobId, JOB_NAME, "usRate", counter, syncProperties.marketData().manualCooldown(), this::syncUsPolicyRate);
        int krRateRows = runSource(jobId, JOB_NAME, "krRate", counter, syncProperties.marketData().manualCooldown(), this::syncKoreanPolicyRate);
        int foreignReserveRows = runSource(jobId, JOB_NAME, "foreignReserve", counter, syncProperties.marketData().manualCooldown(), this::syncForeignReserves);
        int domesticPolicyRows = runSource(jobId, JOB_NAME, "domesticPolicy", counter, syncProperties.marketData().manualCooldown(), this::syncDomesticPolicyIndicators);

        String status = syncStatus(counter);
        String message = "exchange=" + exchangeRows + ", dailyBackfill=" + dailyBackfillRows + ", intradayExchange=" + intradayExchangeRows + ", dollarIndex=" + dollarIndexRows + ", currencyStrength=" + currencyStrengthRows + ", usRate=" + usRateRows + ", krRate=" + krRateRows + ", foreignReserve=" + foreignReserveRows + ", domesticPolicy=" + domesticPolicyRows + counter.message;
        finishJob(jobId, status, Instant.now(), message);
        SyncWindow syncWindow = currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), Instant.now());
        return new SyncResult(exchangeRows + dailyBackfillRows, intradayExchangeRows, dollarIndexRows, currencyStrengthRows, usRateRows, krRateRows, foreignReserveRows, domesticPolicyRows, status, message, trigger.name(), startedAt, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    @Transactional
    protected SyncResult runCurrencyStrengthSync(SyncTrigger trigger) {
        Instant startedAt = Instant.now();
        Long jobId = startJob(JOB_NAME, startedAt, trigger);
        SyncCounter counter = new SyncCounter();

        int currencyStrengthRows = runSource(jobId, JOB_NAME, "currencyStrength", counter, syncProperties.marketData().manualCooldown(), this::syncEffectiveExchangeRates);

        String status = syncStatus(counter);
        String message = "currencyStrength=" + currencyStrengthRows + counter.message;
        finishJob(jobId, status, Instant.now(), message);
        SyncWindow syncWindow = currentSyncWindow(JOB_NAME, syncProperties.marketData().manualCooldown(), Instant.now());
        return new SyncResult(0, 0, 0, currencyStrengthRows, 0, 0, 0, 0, status, message, trigger.name(), startedAt, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    @Transactional
    protected SyncResult runIntradaySync(SyncTrigger trigger) {
        Instant startedAt = Instant.now();
        Long jobId = startJob(INTRADAY_JOB_NAME, startedAt, trigger);
        SyncCounter counter = new SyncCounter();
        List<String> messages = new ArrayList<>();

        int intradayExchangeRows = runSource(jobId, INTRADAY_JOB_NAME, "intradayExchange", counter, syncProperties.marketData().intradayCooldown(), () -> {
            IntradaySyncOutcome outcome = syncUsdKrwIntraday(trigger);
            if (outcome.message() != null && !outcome.message().isBlank()) {
                messages.add(outcome.message());
            }
            return outcome.rows();
        });

        String status = syncStatus(counter);
        String message = "intradayExchange=" + intradayExchangeRows + (messages.isEmpty() ? "" : ", " + String.join(", ", messages)) + counter.message;
        finishJob(jobId, status, Instant.now(), message);
        SyncWindow syncWindow = currentSyncWindow(INTRADAY_JOB_NAME, syncProperties.marketData().intradayCooldown(), Instant.now());
        return new SyncResult(0, intradayExchangeRows, 0, 0, 0, 0, 0, 0, status, message, trigger.name(), startedAt, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    @Transactional
    protected SyncResult runDailyBackfill(SyncTrigger trigger) {
        Instant startedAt = Instant.now();
        Long jobId = startJob(DAILY_BACKFILL_JOB_NAME, startedAt, trigger);
        SyncCounter counter = new SyncCounter();

        int exchangeRows = runSource(jobId, DAILY_BACKFILL_JOB_NAME, "dailyBackfill", counter, syncProperties.marketData().dailyBackfillCooldown(), this::syncUsdKrwDailyBackfill);

        String status = syncStatus(counter);
        String message = "dailyBackfill=" + exchangeRows + counter.message;
        finishJob(jobId, status, Instant.now(), message);
        SyncWindow syncWindow = currentSyncWindow(DAILY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), Instant.now());
        return new SyncResult(exchangeRows, 0, 0, 0, 0, 0, 0, 0, status, message, trigger.name(), startedAt, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    @Transactional
    protected SyncResult runExchangeRateHistoryBackfill(SyncTrigger trigger) {
        Instant startedAt = Instant.now();
        Long jobId = startJob(EXCHANGE_RATE_HISTORY_BACKFILL_JOB_NAME, startedAt, trigger);
        SyncCounter counter = new SyncCounter();

        int exchangeRows = runSource(jobId, EXCHANGE_RATE_HISTORY_BACKFILL_JOB_NAME, "exchangeRateHistoryBackfill", counter, syncProperties.marketData().dailyBackfillCooldown(), this::syncExchangeRatesFromFred);

        String status = syncStatus(counter);
        String message = "exchangeRateHistoryBackfill=" + exchangeRows + counter.message;
        finishJob(jobId, status, Instant.now(), message);
        SyncWindow syncWindow = currentSyncWindow(EXCHANGE_RATE_HISTORY_BACKFILL_JOB_NAME, syncProperties.marketData().dailyBackfillCooldown(), Instant.now());
        return new SyncResult(exchangeRows, 0, 0, 0, 0, 0, 0, 0, status, message, trigger.name(), startedAt, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    @Transactional
    protected SyncResult runCurrentExchangeRateSync(SyncTrigger trigger) {
        Instant startedAt = Instant.now();
        Long jobId = startJob(CURRENT_EXCHANGE_RATE_JOB_NAME, startedAt, trigger);
        SyncCounter counter = new SyncCounter();

        int exchangeRows = runSource(jobId, CURRENT_EXCHANGE_RATE_JOB_NAME, "currentExchange", counter, Duration.ZERO, () -> syncCurrentExchangeRatesFromTwelveData(CURRENT_EXCHANGE_RATE_BATCH_SIZE));

        String status = syncStatus(counter);
        String message = "currentExchange=" + exchangeRows + counter.message;
        finishJob(jobId, status, Instant.now(), message);
        return new SyncResult(exchangeRows, 0, 0, 0, 0, 0, 0, 0, status, message, trigger.name(), startedAt, null, 0);
    }

    private int runSource(Long jobId, String jobName, String sourceName, SyncCounter counter, Duration sourceCooldown, IntSupplier supplier) {
        Instant startedAt = Instant.now();
        if (!canRunSource(jobName, sourceName, sourceCooldown, startedAt)) {
            recordSourceRun(jobId, jobName, sourceName, "SKIPPED_COOLDOWN", 0, null, null, startedAt, startedAt);
            counter.skippedSources++;
            counter.message += ", " + sourceName + "=SKIPPED_COOLDOWN";
            return 0;
        }

        try {
            int rows = supplier.getAsInt();
            recordSourceRun(jobId, jobName, sourceName, "SUCCESS", rows, null, null, startedAt, Instant.now());
            return rows;
        } catch (RuntimeException exception) {
            counter.failures++;
            if (isCoreSource(sourceName)) {
                counter.coreFailures++;
            }
            counter.message += ", " + sourceName + "Error=" + exception.getClass().getSimpleName();
            recordSourceRun(jobId, jobName, sourceName, "FAILED", 0, exception.getClass().getSimpleName(), exception.getMessage(), startedAt, Instant.now());
            return 0;
        }
    }

    private int syncExchangeRates() {
        LocalDate targetDate = LocalDate.now(SEOUL_ZONE);
        int currentRows = syncCurrentExchangeRatesFromTwelveData(CURRENT_EXCHANGE_RATE_BATCH_SIZE);
        int historicalRows = syncExchangeRatesFromFred();
        if (currentRows > 0 || historicalRows > 0) {
            return currentRows + historicalRows;
        }

        if (hasAnyCurrentForeignExchangeRate()) {
            return 0;
        }

        try {
            List<KoreaeximExchangeClient.ExchangeRatePayload> payloads = koreaeximExchangeClient.fetchLatestExchangeRates(targetDate, MAJOR_EXCHANGE_RATE_PREFIXES);
            if (payloads.isEmpty()) {
                return syncExchangeRatesFromFred();
            }

            int rows = payloads.stream()
                .mapToInt(payload -> upsertExchangeRate(payload.baseDate(), payload.currencyCode(), payload.currencyName(), payload.dealBasRate(), "KOREAEXIM"))
                .sum();
            boolean hasUsd = payloads.stream().anyMatch(payload -> payload.currencyCode().startsWith("USD"));
            return hasUsd ? rows : rows + syncExchangeRatesFromFred();
        } catch (RuntimeException exception) {
            return syncExchangeRatesFromFred();
        }
    }

    private int syncUsdKrwDailyBackfill() {
        return backfillMissingWeekdaysFromIntraday();
    }

    private int backfillMissingWeekdaysFromIntraday() {
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(14);
        LocalDate endDate = today.minusDays(1);
        Set<LocalDate> existingDates = new HashSet<>(findDailyUsdKrwDates(startDate, endDate));
        int rows = 0;
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            BusinessDayService.KoreanBusinessDayStatus businessDayStatus = businessDayService.koreanBusinessDayStatus(date);
            if (businessDayStatus != BusinessDayService.KoreanBusinessDayStatus.BUSINESS_DAY || existingDates.contains(date)) {
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
        return upsertExchangeRate(
            baseDate,
            "USD",
            "US Dollar",
            rate,
            source
        );
    }

    private int upsertExchangeRate(LocalDate baseDate, String currencyCode, String currencyName, java.math.BigDecimal rate, String source) {
        return upsertExchangeRate(baseDate, currencyCode, currencyName, rate, source, Instant.now());
    }

    private int upsertExchangeRate(LocalDate baseDate, String currencyCode, String currencyName, java.math.BigDecimal rate, String source, Instant fetchedAt) {
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
            currencyCode,
            currencyName,
            rate,
            source,
            fetchedAt
        );
    }

    private int upsertCurrentExchangeRate(LocalDate baseDate, String currencyCode, String currencyName, java.math.BigDecimal rate, String source, Instant observedAt) {
        return jdbcTemplate.update("""
                INSERT INTO current_exchange_rates (base_date, currency_code, currency_name, deal_bas_rate, source, observed_at, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    base_date = VALUES(base_date),
                    currency_name = VALUES(currency_name),
                    deal_bas_rate = VALUES(deal_bas_rate),
                    source = VALUES(source),
                    observed_at = VALUES(observed_at),
                    fetched_at = VALUES(fetched_at)
                """,
            baseDate,
            currencyCode,
            currencyName,
            rate,
            source,
            observedAt,
            observedAt
        );
    }

    private int syncCurrentExchangeRatesFromTwelveData(int maxUpdates) {
        Instant staleThreshold = Instant.now().minus(CURRENT_EXCHANGE_RATE_STALE_AFTER);
        return twelveDataExchangeSpecs().stream()
            .map(spec -> new TwelveDataExchangeCandidate(spec, findLatestCurrentExchangeRateFetch(spec.currencyCode())))
            .filter(candidate -> candidate.latestFetchedAt() == null || candidate.latestFetchedAt().isBefore(staleThreshold))
            .sorted(Comparator.comparing(
                TwelveDataExchangeCandidate::latestFetchedAt,
                Comparator.nullsFirst(Comparator.naturalOrder())
            ))
            .limit(maxUpdates)
            .mapToInt(spec -> {
                try {
                    return twelveDataClient.fetchCurrentExchangeRate(spec.spec().symbol())
                        .map(payload -> {
                            upsertCurrentExchangeRate(
                                LocalDate.ofInstant(payload.observedAt(), SEOUL_ZONE),
                                spec.spec().currencyCode(),
                                spec.spec().currencyName(),
                                spec.spec().toDisplayRate(payload.rate()),
                                "TWELVE_DATA:exchange_rate:" + spec.spec().symbol(),
                                payload.observedAt()
                            );
                            return 1;
                        })
                        .orElse(0);
                } catch (RuntimeException exception) {
                    return 0;
                }
            })
            .sum();
    }

    private List<TwelveDataExchangeSpec> twelveDataExchangeSpecs() {
        return List.of(
            new TwelveDataExchangeSpec("USD/KRW", "USD", "US Dollar", BigDecimal.ONE),
            new TwelveDataExchangeSpec("JPY/KRW", "JPY(100)", "Japanese Yen", BigDecimal.valueOf(100)),
            new TwelveDataExchangeSpec("EUR/KRW", "EUR", "Euro", BigDecimal.ONE),
            new TwelveDataExchangeSpec("CNY/KRW", "CNY", "Chinese Yuan", BigDecimal.ONE),
            new TwelveDataExchangeSpec("GBP/KRW", "GBP", "British Pound", BigDecimal.ONE),
            new TwelveDataExchangeSpec("AUD/KRW", "AUD", "Australian Dollar", BigDecimal.ONE),
            new TwelveDataExchangeSpec("CAD/KRW", "CAD", "Canadian Dollar", BigDecimal.ONE),
            new TwelveDataExchangeSpec("CHF/KRW", "CHF", "Swiss Franc", BigDecimal.ONE),
            new TwelveDataExchangeSpec("HKD/KRW", "HKD", "Hong Kong Dollar", BigDecimal.ONE),
            new TwelveDataExchangeSpec("SGD/KRW", "SGD", "Singapore Dollar", BigDecimal.ONE)
        );
    }

    private Instant findLatestCurrentExchangeRateFetch(String currencyCode) {
        return jdbcTemplate.query(
            """
                SELECT MAX(fetched_at)
                FROM current_exchange_rates
                WHERE currency_code = ?
                """,
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toInstant(),
            currencyCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private boolean hasAnyCurrentForeignExchangeRate() {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM current_exchange_rates
                WHERE currency_code <> 'USD'
                """,
            Integer.class
        );
        return count != null && count > 0;
    }

    private int syncUsdKrwFromFred() {
        String seriesId = properties.fred().usdKrwSeriesId();
        LocalDate latestDate = findLatestDailyUsdKrwDate();
        LocalDate earliestDate = findEarliestDailyExchangeRateDate("USD");
        LocalDate observationStart;
        if (earliestDate == null || earliestDate.isAfter(EXCHANGE_RATE_HISTORY_START_DATE)) {
            observationStart = EXCHANGE_RATE_HISTORY_START_DATE;
        } else if (latestDate == null) {
            observationStart = EXCHANGE_RATE_HISTORY_START_DATE;
        } else {
            observationStart = latestDate.minusDays(7);
        }
        List<FredClient.FredObservationPayload> observations = fredClient.fetchObservations(seriesId, observationStart);
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

    private int syncExchangeRatesFromFred() {
        int rows = syncUsdKrwFromFred();
        NavigableMap<LocalDate, BigDecimal> usdKrwRates = findDailyExchangeRateMap("USD", EXCHANGE_RATE_HISTORY_START_DATE);
        if (usdKrwRates.isEmpty()) {
            return rows;
        }

        return rows + fredExchangeSpecs().stream()
            .mapToInt(spec -> syncFredExchangeSpec(spec, usdKrwRates))
            .sum();
    }

    private int syncFredExchangeSpec(FredExchangeSpec spec, NavigableMap<LocalDate, BigDecimal> usdKrwRates) {
        LocalDate latestDate = findLatestDailyExchangeRateDate(spec.currencyCode());
        LocalDate earliestDate = findEarliestDailyExchangeRateDate(spec.currencyCode());
        LocalDate observationStart;
        if (earliestDate == null || earliestDate.isAfter(EXCHANGE_RATE_HISTORY_START_DATE)) {
            observationStart = EXCHANGE_RATE_HISTORY_START_DATE;
        } else if (latestDate == null) {
            observationStart = EXCHANGE_RATE_HISTORY_START_DATE;
        } else {
            observationStart = latestDate.minusDays(7);
        }

        return fredClient.fetchObservations(spec.seriesId(), observationStart).stream()
            .mapToInt(payload -> {
                var usdEntry = usdKrwRates.floorEntry(payload.baseDate());
                if (usdEntry == null) {
                    return 0;
                }

                return upsertExchangeRate(
                    payload.baseDate(),
                    spec.currencyCode(),
                    spec.currencyName(),
                    spec.toKrwRate(usdEntry.getValue(), payload.value()),
                    "FRED:" + properties.fred().usdKrwSeriesId() + "/" + spec.seriesId()
                );
            })
            .sum();
    }

    private List<FredExchangeSpec> fredExchangeSpecs() {
        return List.of(
            new FredExchangeSpec("JPY(100)", "Japanese Yen", "DEXJPUS", false, BigDecimal.valueOf(100)),
            new FredExchangeSpec("EUR", "Euro", "DEXUSEU", true, BigDecimal.ONE),
            new FredExchangeSpec("CNY", "Chinese Yuan", "DEXCHUS", false, BigDecimal.ONE),
            new FredExchangeSpec("GBP", "British Pound", "DEXUSUK", true, BigDecimal.ONE),
            new FredExchangeSpec("AUD", "Australian Dollar", "DEXUSAL", true, BigDecimal.ONE),
            new FredExchangeSpec("CAD", "Canadian Dollar", "DEXCAUS", false, BigDecimal.ONE),
            new FredExchangeSpec("CHF", "Swiss Franc", "DEXSZUS", false, BigDecimal.ONE),
            new FredExchangeSpec("HKD", "Hong Kong Dollar", "DEXHKUS", false, BigDecimal.ONE),
            new FredExchangeSpec("SGD", "Singapore Dollar", "DEXSIUS", false, BigDecimal.ONE)
        );
    }

    private LatestExchangeRate findLatestDailyExchangeRate(String currencyCode) {
        return jdbcTemplate.query(
            """
                SELECT base_date, deal_bas_rate
                FROM exchange_rates
                WHERE currency_code = ?
                ORDER BY base_date DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new LatestExchangeRate(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("deal_bas_rate")),
            currencyCode
        ).stream().findFirst().orElse(null);
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
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private LocalDate findLatestDailyExchangeRateDate(String currencyCode) {
        return jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM exchange_rates
                WHERE currency_code = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            currencyCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private LocalDate findEarliestDailyExchangeRateDate(String currencyCode) {
        return jdbcTemplate.query(
            """
                SELECT MIN(base_date)
                FROM exchange_rates
                WHERE currency_code = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            currencyCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private NavigableMap<LocalDate, BigDecimal> findDailyExchangeRateMap(String currencyCode, LocalDate startDate) {
        NavigableMap<LocalDate, BigDecimal> rates = new TreeMap<>();
        jdbcTemplate.query(
            """
                SELECT base_date, deal_bas_rate
                FROM exchange_rates
                WHERE currency_code = ?
                  AND base_date >= ?
                ORDER BY base_date ASC
                """,
            (org.springframework.jdbc.core.RowCallbackHandler) rs -> rates.put(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("deal_bas_rate")),
            currencyCode,
            startDate
        );
        return rates;
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

    private LocalDate findLatestDollarIndexDate(String seriesId) {
        return jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM dollar_indexes
                WHERE series_id = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            seriesId
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private LocalDate findLatestInterestRateDate(String countryCode, String rateType) {
        return jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM interest_rates
                WHERE country_code = ?
                  AND rate_type = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            countryCode,
            rateType
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private LocalDate findEarliestInterestRateDate(String countryCode, String rateType) {
        return jdbcTemplate.query(
            """
                SELECT MIN(base_date)
                FROM interest_rates
                WHERE country_code = ?
                  AND rate_type = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            countryCode,
            rateType
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private LocalDate findLatestDomesticPolicyDate(String indicatorCode) {
        return jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM domestic_policy_indicators
                WHERE indicator_code = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            indicatorCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private LocalDate findEarliestDomesticPolicyDate(String indicatorCode) {
        return jdbcTemplate.query(
            """
                SELECT MIN(base_date)
                FROM domestic_policy_indicators
                WHERE indicator_code = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            indicatorCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private int syncDollarIndexes() {
        return syncDollarIndex(properties.fred().dollarIndexSeriesId(), "FRED")
            + syncDollarIndex(properties.fred().advancedDollarIndexSeriesId(), "FRED");
    }

    private int syncDollarIndex(String seriesId, String source) {
        LocalDate observationStart = findLatestDollarIndexDate(seriesId);
        if (observationStart == null) {
            observationStart = LocalDate.now(SEOUL_ZONE).minusYears(5);
        } else {
            observationStart = observationStart.minusDays(DOLLAR_INDEX_REFRESH_OVERLAP_DAYS);
        }
        List<FredClient.FredObservationPayload> observations = fredClient.fetchObservations(seriesId, observationStart);
        Instant fetchedAt = Instant.now();
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
                source,
                fetchedAt
            ))
            .sum();
    }

    private int syncEffectiveExchangeRates() {
        if (!shouldSyncEffectiveExchangeRates(LocalDateTime.now(SEOUL_ZONE))) {
            return 0;
        }

        List<BisClient.EffectiveExchangeRatePayload> observations = bisClient.fetchLatestBroadEffectiveExchangeRates();
        return observations.stream()
            .mapToInt(payload -> jdbcTemplate.update("""
                    INSERT INTO effective_exchange_rates (base_date, area_code, area_name, index_type, basket_type, value, source, fetched_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        area_name = VALUES(area_name),
                        value = VALUES(value),
                        source = VALUES(source),
                        fetched_at = VALUES(fetched_at)
                    """,
                payload.baseDate(),
                payload.areaCode(),
                payload.areaName(),
                payload.indexType(),
                payload.basketType(),
                payload.value(),
                "BIS:WS_EER",
                payload.fetchedAt()
            ))
            .sum();
    }

    private boolean shouldSyncEffectiveExchangeRates(LocalDateTime now) {
        Instant latestWeeklyDueAt = latestCompletedCurrencyStrengthWeeklyDueAt(now);
        return !hasSuccessfulSourceRunSince(JOB_NAME, "currencyStrength", latestWeeklyDueAt);
    }

    private Instant latestCompletedCurrencyStrengthWeeklyDueAt(LocalDateTime now) {
        int daysSinceFriday = Math.floorMod(
            now.getDayOfWeek().getValue() - DayOfWeek.FRIDAY.getValue(),
            7
        );
        LocalDate fridaySessionStartDate = now.toLocalDate().minusDays(daysSinceFriday);
        LocalDateTime dueAt = UsdKrwIntradaySession.endDateTime(fridaySessionStartDate);
        if (now.isBefore(dueAt)) {
            dueAt = UsdKrwIntradaySession.endDateTime(fridaySessionStartDate.minusWeeks(1));
        }

        return dueAt.atZone(SEOUL_ZONE).toInstant();
    }

    private IntradaySyncOutcome syncUsdKrwIntraday(SyncTrigger trigger) {
        List<TwelveDataClient.IntradayExchangePayload> observations;
        String message = null;
        Integer committedRows = null;
        LocalDate activeSessionStartDate = UsdKrwIntradaySession.activeSessionStartDate(LocalDateTime.now(SEOUL_ZONE));
        if (activeSessionStartDate != null) {
            observations = fetchUsdKrwSessionFromTwelveData(activeSessionStartDate, true);
            if (observations.isEmpty() && needsPreviousUsdKrwSessionBackfill(trigger)) {
                BackfillFetchOutcome outcome = fetchPreviousUsdKrwSessionFromTwelveData(trigger);
                observations = outcome.observations();
                committedRows = outcome.rows();
                message = outcome.message();
            }
        } else if (needsPreviousUsdKrwSessionBackfill(trigger)) {
            BackfillFetchOutcome outcome = fetchPreviousUsdKrwSessionFromTwelveData(trigger);
            observations = outcome.observations();
            committedRows = outcome.rows();
            message = outcome.message();
        } else {
            observations = List.of();
        }
        int rows = committedRows == null ? upsertIntradayExchangeRates(observations) : committedRows;
        return new IntradaySyncOutcome(rows, message);
    }

    private List<TwelveDataClient.IntradayExchangePayload> fetchUsdKrwSessionFromTwelveData(LocalDate sessionStartDate, boolean capAtNow) {
        LocalDateTime sessionStart = UsdKrwIntradaySession.startDateTime(sessionStartDate);
        LocalDateTime sessionEnd = UsdKrwIntradaySession.endDateTime(sessionStartDate);
        LocalDateTime now = LocalDateTime.now(SEOUL_ZONE);
        if (capAtNow && now.isAfter(sessionStart) && now.isBefore(sessionEnd)) {
            sessionEnd = now;
        }

        LocalDateTime sessionEndInclusive = sessionEnd;
        return twelveDataClient.fetchUsdKrwIntradayBetween(sessionStart, sessionEnd).stream()
            .filter(payload -> !payload.observedAt().isBefore(sessionStart) && !payload.observedAt().isAfter(sessionEndInclusive))
            .toList();
    }

    private BackfillFetchOutcome fetchPreviousUsdKrwSessionFromTwelveData(SyncTrigger trigger) {
        LocalDate sessionStartDate = resolveBackfillSessionStartDate();
        BackfillSessionDecision decision = decideBackfillSession(sessionStartDate, trigger, Instant.now());
        if (!decision.canAttempt()) {
            recordUsdKrwBackfillAttempt(
                decision.sessionKey(),
                sessionStartDate,
                decision.status(),
                0,
                decision.latestObservedAt(),
                decision.latestObservedAt(),
                decision.noChangeCount(),
                Instant.now(),
                decision.nextAllowedAt(),
                decision.message()
            );
            return new BackfillFetchOutcome(List.of(), 0, formatBackfillMessage(decision.sessionKey(), decision.status(), decision.message()));
        }

        LocalDateTime previousLatestObservedAt = findLatestIntradayObservedAt(sessionStartDate);
        List<TwelveDataClient.IntradayExchangePayload> observations = fetchUsdKrwSessionFromTwelveData(sessionStartDate, false);
        int rows = upsertIntradayExchangeRates(observations);
        LocalDateTime latestObservedAt = findLatestIntradayObservedAt(sessionStartDate);
        boolean advanced = previousLatestObservedAt == null
            ? latestObservedAt != null
            : latestObservedAt != null && latestObservedAt.isAfter(previousLatestObservedAt);
        String status = advanced ? USD_KRW_BACKFILL_STATUS_BACKFILLED : USD_KRW_BACKFILL_STATUS_NO_CHANGE;
        int noChangeCount = advanced ? 0 : decision.noChangeCount() + 1;
        Instant nextAllowedAt = Instant.now().plus(syncProperties.marketData().intradayBackfillSessionCooldown());
        String resultMessage = advanced
            ? "latestObservedAt advanced"
            : "no new observations returned";
        recordUsdKrwBackfillAttempt(
            decision.sessionKey(),
            sessionStartDate,
            status,
            rows,
            previousLatestObservedAt,
            latestObservedAt,
            noChangeCount,
            Instant.now(),
            nextAllowedAt,
            resultMessage
        );
        return new BackfillFetchOutcome(List.of(), rows, formatBackfillMessage(decision.sessionKey(), status, resultMessage));
    }

    private LocalDate resolveBackfillSessionStartDate() {
        LocalDateTime latestObservedAt = findLatestIntradayObservedAt();
        if (latestObservedAt != null) {
            LocalDate latestSessionStartDate = UsdKrwIntradaySession.sessionStartDate(latestObservedAt);
            if (UsdKrwIntradaySession.canStartSession(latestSessionStartDate) && isSessionIncomplete(latestSessionStartDate, latestObservedAt)) {
                return latestSessionStartDate;
            }
        }

        return UsdKrwIntradaySession.previousSessionStartDate(LocalDate.now(SEOUL_ZONE));
    }

    private int upsertIntradayExchangeRates(List<TwelveDataClient.IntradayExchangePayload> observations) {
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
        LocalDate historyStartDate = LocalDate.now(SEOUL_ZONE).minusYears(5);
        if (hasRecentInterestRateFetch("US", "POLICY_RATE", startOfTodayInSeoul())
            && hasInterestRateCoverage("US", "POLICY_RATE", historyStartDate)) {
            return 0;
        }

        String seriesId = properties.fred().usPolicyRateSeriesId();
        LocalDate observationStart = findLatestInterestRateDate("US", "POLICY_RATE");
        if (observationStart == null || !hasInterestRateCoverage("US", "POLICY_RATE", historyStartDate)) {
            observationStart = historyStartDate;
        } else {
            observationStart = observationStart.minusMonths(3);
        }
        List<FredClient.FredObservationPayload> observations = fredClient.fetchObservations(seriesId, observationStart);
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
        LocalDate historyStartDate = LocalDate.now(SEOUL_ZONE).minusYears(5);
        if (hasRecentInterestRateFetch("KR", "POLICY_RATE", startOfTodayInSeoul())
            && hasInterestRateCoverage("KR", "POLICY_RATE", historyStartDate)) {
            return 0;
        }

        LocalDate observationStart = findLatestInterestRateDate("KR", "POLICY_RATE");
        if (observationStart == null || !hasInterestRateCoverage("KR", "POLICY_RATE", historyStartDate)) {
            observationStart = historyStartDate;
        } else {
            observationStart = observationStart.minusMonths(3);
        }
        List<EcosClient.EcosObservationPayload> observations = ecosClient.fetchKoreanPolicyRates(observationStart, LocalDate.now(SEOUL_ZONE));
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
        YearMonth currentMonth = YearMonth.now(SEOUL_ZONE);
        YearMonth startMonth = currentMonth.minusYears(5);
        List<EcosClient.EcosObservationPayload> observations = ecosClient.fetchForeignReserves(startMonth, currentMonth);
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

    private int syncDomesticPolicyIndicators() {
        YearMonth currentMonth = YearMonth.now(SEOUL_ZONE);
        YearMonth historyStartMonth = currentMonth.minusYears(5);
        List<DomesticPolicySpec> specs = List.of(
            new DomesticPolicySpec("M2", "M2 통화량", "통화 정책", "161Y005", "BBHS00", "KRW_100M", "ECOS:161Y005"),
            new DomesticPolicySpec("CURRENT_ACCOUNT", "경상수지", "대외 수지", "301Y017", "SA000", "USD_MILLION", "ECOS:301Y017"),
            new DomesticPolicySpec("GOODS_ACCOUNT", "상품수지", "대외 수지", "301Y017", "SA100", "USD_MILLION", "ECOS:301Y017"),
            new DomesticPolicySpec("CPI", "소비자물가지수", "물가 압력", "901Y009", "0", "INDEX", "ECOS:901Y009"),
            new DomesticPolicySpec("PPI", "생산자물가지수", "물가 압력", "404Y014", "*AA", "INDEX", "ECOS:404Y014"),
            new DomesticPolicySpec("EXPORT_AMOUNT", "수출금액", "달러 유입", "901Y118", "T002", "USD_1000", "ECOS:901Y118"),
            new DomesticPolicySpec("IMPORT_AMOUNT", "수입금액", "달러 유출", "901Y118", "T004", "USD_1000", "ECOS:901Y118"),
            new DomesticPolicySpec("TERMS_OF_TRADE", "순상품교역조건", "교역조건", "403Y005", "A", "INDEX", "ECOS:403Y005")
        );

        int rows = 0;
        List<EcosClient.EcosObservationPayload> exportAmounts = List.of();
        List<EcosClient.EcosObservationPayload> importAmounts = List.of();
        for (DomesticPolicySpec spec : specs) {
            YearMonth observationStart = domesticPolicyRefreshStartMonth(spec.code(), historyStartMonth);
            List<EcosClient.EcosObservationPayload> observations = ecosClient.fetchStatisticObservations(
                spec.statCode(),
                "M",
                observationStart,
                currentMonth,
                spec.itemCode()
            );
            rows += upsertDomesticPolicyIndicators(spec, observations);
            if ("EXPORT_AMOUNT".equals(spec.code())) {
                exportAmounts = observations;
            } else if ("IMPORT_AMOUNT".equals(spec.code())) {
                importAmounts = observations;
            }
        }

        rows += upsertTradeBalance(exportAmounts, importAmounts);
        rows += syncExternalDefenseIndicators(currentMonth, historyStartMonth);
        rows += syncFredRiskIndicators();
        rows += syncOpenFiscalIndicators();
        rows += syncForeignCapitalFlowIndicators(currentMonth, historyStartMonth);
        rows += syncMpcMinutesIndicator();
        return rows;
    }

    private int syncExternalDefenseIndicators(YearMonth currentMonth, YearMonth historyStartMonth) {
        YearMonth startMonth = quarterlyDomesticPolicyRefreshStartMonth("SHORT_TERM_EXTERNAL_DEBT", historyStartMonth);
        String startQuarter = toEcosQuarter(startMonth.minusMonths(2));
        String endQuarter = toEcosQuarter(currentMonth);
        List<EcosClient.EcosObservationPayload> shortTermDebts = ecosClient.fetchStatisticObservations(
            "311Y004",
            "Q",
            startQuarter,
            endQuarter,
            "A500000"
        );
        List<EcosClient.EcosObservationPayload> reserveTotals = ecosClient.fetchStatisticObservations(
            "732Y001",
            "Q",
            startQuarter,
            endQuarter,
            "99"
        ).stream()
            .map(payload -> new EcosClient.EcosObservationPayload(
                payload.baseDate(),
                payload.value().divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP)
            ))
            .toList();

        int rows = 0;
        rows += shortTermDebts.stream()
            .mapToInt(payload -> upsertDomesticPolicyIndicator(
                "SHORT_TERM_EXTERNAL_DEBT",
                "단기대외채무",
                "외환 방어력",
                payload.baseDate(),
                payload.value(),
                "USD_MILLION",
                "ECOS:311Y004"
            ))
            .sum();

        for (EcosClient.EcosObservationPayload shortTermDebt : shortTermDebts) {
            if (shortTermDebt.value().compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }
            rows += reserveTotals.stream()
                .filter(reserve -> reserve.baseDate().equals(shortTermDebt.baseDate()))
                .findFirst()
                .map(reserve -> upsertDomesticPolicyIndicator(
                        "RESERVES_TO_SHORT_TERM_DEBT",
                        "단기외채 대비 외환보유액",
                        "외환 방어력",
                        shortTermDebt.baseDate(),
                        reserve.value().multiply(new BigDecimal("100")).divide(shortTermDebt.value(), 4, RoundingMode.HALF_UP),
                        "PERCENT",
                        "ECOS:732Y001/311Y004"
                    )
                )
                .orElse(0);
        }
        return rows;
    }

    private int syncForeignCapitalFlowIndicators(YearMonth currentMonth, YearMonth historyStartMonth) {
        int rows = 0;
        YearMonth stockStartMonth = domesticPolicyRefreshStartMonth("FOREIGN_STOCK_FLOW", historyStartMonth);
        rows += ecosClient.fetchStatisticObservations("901Y055", "M", stockStartMonth, currentMonth, "S22CC", "VA").stream()
            .map(payload -> new EcosClient.EcosObservationPayload(
                payload.baseDate(),
                payload.value().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP)
            ))
            .mapToInt(payload -> upsertDomesticPolicyIndicator(
                "FOREIGN_STOCK_FLOW",
                "외국인 주식 순매수",
                "자본 흐름",
                payload.baseDate(),
                payload.value(),
                "KRW_100M",
                "ECOS:901Y055"
            ))
            .sum();

        YearMonth bondStartMonth = quarterlyDomesticPolicyRefreshStartMonth("FOREIGN_BOND_FLOW", historyStartMonth);
        String startQuarter = toEcosQuarter(bondStartMonth.minusMonths(2));
        String endQuarter = toEcosQuarter(currentMonth);
        rows += ecosClient.fetchStatisticObservations("282Y006", "Q", startQuarter, endQuarter, "ITOT", "HA02").stream()
            .map(payload -> new EcosClient.EcosObservationPayload(
                payload.baseDate(),
                payload.value().divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP)
            ))
            .mapToInt(payload -> upsertDomesticPolicyIndicator(
                "FOREIGN_BOND_FLOW",
                "외국인 채권 보유잔액",
                "자본 흐름",
                payload.baseDate(),
                payload.value(),
                "KRW_TRILLION",
                "ECOS:282Y006"
            ))
            .sum();
        return rows;
    }

    private int syncMpcMinutesIndicator() {
        if (hasRecentDomesticPolicyFetch("MPC_MINUTES", startOfTodayInSeoul())) {
            return 0;
        }

        return bokPortalClient.fetchLatestMpcMinutesSignal()
            .map(payload -> upsertDomesticPolicyIndicator(
                "MPC_MINUTES",
                payload.title(),
                "통화정책 방향",
                payload.baseDate(),
                BigDecimal.ONE,
                "DOCUMENT",
                "BOK:200789"
            ))
            .orElse(0);
    }

    private int syncOpenFiscalIndicators() {
        LocalDate historyStartDate = LocalDate.now().minusYears(5).withDayOfMonth(1);
        int startYear = hasDomesticPolicyCoverage("FISCAL_BALANCE", historyStartDate)
            && hasDomesticPolicyCoverage("GOVERNMENT_DEBT", historyStartDate)
            ? LocalDate.now(SEOUL_ZONE).minusYears(1).getYear()
            : LocalDate.now(SEOUL_ZONE).minusYears(5).getYear();
        int endYear = LocalDate.now(SEOUL_ZONE).getYear();
        int rows = 0;
        rows += openFiscalClient.fetchBudgetBalances(startYear, endYear).stream()
            .mapToInt(payload -> upsertDomesticPolicyIndicator(
                "FISCAL_BALANCE",
                "재정수지",
                "재정 정책",
                payload.baseDate(),
                payload.value(),
                "KRW_TRILLION",
                "OPENFISCAL:BudgetBalance"
            ))
            .sum();
        rows += openFiscalClient.fetchGovernmentDebtMonths(startYear, endYear).stream()
            .mapToInt(payload -> upsertDomesticPolicyIndicator(
                "GOVERNMENT_DEBT",
                "중앙정부 국가채무",
                "재정 정책",
                payload.baseDate(),
                payload.value(),
                "KRW_TRILLION",
                "OPENFISCAL:GovernmentDebtMonth"
            ))
            .sum();
        return rows;
    }

    private int syncFredRiskIndicators() {
        LocalDate startDate = LocalDate.now().minusYears(5);
        return syncFredDomesticPolicyIndicator(
            "US_10Y_TREASURY",
            "미국 10년 국채금리",
            "미국 금융여건",
            properties.fred().usTenYearTreasurySeriesId(),
            "PERCENT",
            startDate
        ) + syncFredDomesticPolicyIndicator(
            "VIX",
            "VIX 변동성 지수",
            "대외 리스크",
            properties.fred().vixSeriesId(),
            "INDEX",
            startDate
        ) + syncFredDomesticPolicyIndicator(
            "WTI_OIL",
            "WTI 국제유가",
            "원자재·에너지",
            properties.fred().wtiOilSeriesId(),
            "USD",
            startDate
        ) + syncFredDomesticPolicyIndicator(
            "KOREA_CDS",
            "글로벌 신용스프레드 프록시",
            "대외 신용위험",
            properties.fred().creditSpreadProxySeriesId(),
            "PERCENT",
            startDate
        );
    }

    private int syncFredDomesticPolicyIndicator(String code, String title, String category, String seriesId, String unit, LocalDate startDate) {
        if (hasRecentDomesticPolicyFetch(code, startOfTodayInSeoul())
            && hasDomesticPolicyCoverage(code, startDate)) {
            return 0;
        }

        LocalDate observationStart = findLatestDomesticPolicyDate(code);
        if (observationStart == null || !hasDomesticPolicyCoverage(code, startDate)) {
            observationStart = startDate;
        } else {
            observationStart = observationStart.minusDays(14);
        }
        List<FredClient.FredObservationPayload> observations = fredClient.fetchObservations(seriesId, observationStart);
        return observations.stream()
            .mapToInt(payload -> upsertDomesticPolicyIndicator(
                code,
                title,
                category,
                payload.baseDate(),
                payload.value(),
                unit,
                "FRED:" + seriesId
            ))
            .sum();
    }

    private int upsertDomesticPolicyIndicators(DomesticPolicySpec spec, List<EcosClient.EcosObservationPayload> observations) {
        return observations.stream()
            .mapToInt(payload -> upsertDomesticPolicyIndicator(
                spec.code(),
                spec.title(),
                spec.category(),
                payload.baseDate(),
                payload.value(),
                spec.unit(),
                spec.source()
            ))
            .sum();
    }

    private YearMonth domesticPolicyRefreshStartMonth(String code, YearMonth historyStartMonth) {
        if (!hasDomesticPolicyCoverage(code, historyStartMonth.atDay(1))) {
            return historyStartMonth;
        }

        LocalDate latestDate = findLatestDomesticPolicyDate(code);
        if (latestDate == null) {
            return historyStartMonth;
        }

        YearMonth recentStartMonth = YearMonth.from(latestDate).minusMonths(RECENT_MONTH_REFRESH_OVERLAP);
        return recentStartMonth.isBefore(historyStartMonth) ? historyStartMonth : recentStartMonth;
    }

    private YearMonth quarterlyDomesticPolicyRefreshStartMonth(String code, YearMonth historyStartMonth) {
        if (!hasDomesticPolicyCoverage(code, historyStartMonth.atDay(1))) {
            return historyStartMonth;
        }

        LocalDate latestDate = findLatestDomesticPolicyDate(code);
        if (latestDate == null) {
            return historyStartMonth;
        }

        YearMonth recentStartMonth = YearMonth.from(latestDate).minusMonths(RECENT_QUARTER_REFRESH_MONTH_OVERLAP);
        return recentStartMonth.isBefore(historyStartMonth) ? historyStartMonth : recentStartMonth;
    }

    private int upsertTradeBalance(List<EcosClient.EcosObservationPayload> exportAmounts, List<EcosClient.EcosObservationPayload> importAmounts) {
        List<EcosClient.EcosObservationPayload> balances = new ArrayList<>();
        for (EcosClient.EcosObservationPayload exportAmount : exportAmounts) {
            importAmounts.stream()
                .filter(importAmount -> importAmount.baseDate().equals(exportAmount.baseDate()))
                .findFirst()
                .ifPresent(importAmount -> balances.add(new EcosClient.EcosObservationPayload(
                    exportAmount.baseDate(),
                    exportAmount.value().subtract(importAmount.value())
                )));
        }

        return balances.stream()
            .mapToInt(payload -> upsertDomesticPolicyIndicator(
                "TRADE_BALANCE",
                "무역수지",
                "달러 수급",
                payload.baseDate(),
                payload.value(),
                "USD_1000",
                "ECOS:901Y118"
            ))
            .sum();
    }

    private int upsertDomesticPolicyIndicator(String code, String title, String category, LocalDate baseDate, BigDecimal value, String unit, String source) {
        return jdbcTemplate.update("""
                INSERT INTO domestic_policy_indicators (indicator_code, title, category, base_date, value, unit, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    title = VALUES(title),
                    category = VALUES(category),
                    value = VALUES(value),
                    unit = VALUES(unit),
                    source = VALUES(source),
                    fetched_at = VALUES(fetched_at)
                """,
            code,
            title,
            category,
            baseDate,
            value,
            unit,
            source,
            Instant.now()
        );
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

    private void recordSourceRun(
        Long jobId,
        String jobName,
        String sourceName,
        String status,
        int rows,
        String errorCode,
        String errorMessage,
        Instant startedAt,
        Instant endedAt
    ) {
        jdbcTemplate.update(
            """
                INSERT INTO batch_job_source_runs
                    (batch_job_run_id, job_name, source_name, status, rows_processed, error_code, error_message, started_at, ended_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
            jobId,
            jobName,
            sourceName,
            status,
            rows,
            errorCode,
            truncateErrorMessage(errorMessage),
            startedAt,
            endedAt
        );
    }

    private String truncateErrorMessage(String errorMessage) {
        if (errorMessage == null || errorMessage.length() <= 1000) {
            return errorMessage;
        }

        return errorMessage.substring(0, 1000);
    }

    private SyncResult skipped(String status, String message, SyncTrigger trigger, SyncWindow syncWindow) {
        return new SyncResult(0, 0, 0, 0, 0, 0, 0, 0, status, message, trigger.name(), null, syncWindow.nextAllowedAt(), syncWindow.remainingCooldownSeconds());
    }

    private boolean shouldRunIntradaySyncNow(SyncTrigger trigger) {
        return UsdKrwIntradaySession.activeSessionStartDate(LocalDateTime.now(SEOUL_ZONE)) != null
            || needsPreviousUsdKrwSessionBackfill(trigger);
    }

    private boolean needsPreviousUsdKrwSessionBackfill() {
        return needsPreviousUsdKrwSessionBackfill(SyncTrigger.SCHEDULED_INTRADAY);
    }

    private boolean needsPreviousUsdKrwSessionBackfill(SyncTrigger trigger) {
        LocalDate targetSessionStartDate = UsdKrwIntradaySession.previousSessionStartDate(LocalDate.now(SEOUL_ZONE));
        LocalDateTime latestObservedAt = findLatestIntradayObservedAt(targetSessionStartDate);
        if (latestObservedAt == null) {
            return decideBackfillSession(targetSessionStartDate, trigger, Instant.now()).canAttempt();
        }

        return isSessionIncomplete(targetSessionStartDate, latestObservedAt)
            && decideBackfillSession(targetSessionStartDate, trigger, Instant.now()).canAttempt();
    }

    private boolean isSessionIncomplete(LocalDate sessionStartDate, LocalDateTime latestObservedAt) {
        LocalDateTime expectedSessionEnd = UsdKrwIntradaySession.endDateTime(sessionStartDate).minusMinutes(5);
        return latestObservedAt.isBefore(expectedSessionEnd);
    }

    private BackfillSessionDecision decideBackfillSession(LocalDate sessionStartDate, SyncTrigger trigger, Instant now) {
        String sessionKey = usdKrwBackfillSessionKey(sessionStartDate);
        UsdKrwBackfillAttempt latestAttempt = findLatestUsdKrwBackfillAttempt(sessionKey);
        LocalDateTime latestObservedAt = findLatestIntradayObservedAt(sessionStartDate);
        if (latestAttempt == null) {
            return new BackfillSessionDecision(true, sessionKey, null, latestObservedAt, 0, null, null);
        }

        if (latestAttempt.nextAllowedAt() != null && now.isBefore(latestAttempt.nextAllowedAt())) {
            return new BackfillSessionDecision(
                false,
                sessionKey,
                USD_KRW_BACKFILL_STATUS_SKIPPED_COOLDOWN,
                latestObservedAt,
                latestAttempt.noChangeCount(),
                latestAttempt.nextAllowedAt(),
                "session retry cooldown active"
            );
        }

        int suspendThreshold = syncProperties.marketData().intradayBackfillNoChangeSuspendThreshold();
        if (suspendThreshold > 0 && latestAttempt.noChangeCount() >= suspendThreshold && !bypassesBackfillSuspension(trigger)) {
            return new BackfillSessionDecision(
                false,
                sessionKey,
                USD_KRW_BACKFILL_STATUS_SKIPPED_SUSPENDED,
                latestObservedAt,
                latestAttempt.noChangeCount(),
                latestAttempt.nextAllowedAt(),
                "no-change threshold reached"
            );
        }

        return new BackfillSessionDecision(true, sessionKey, null, latestObservedAt, latestAttempt.noChangeCount(), null, null);
    }

    private boolean bypassesBackfillSuspension(SyncTrigger trigger) {
        return trigger == SyncTrigger.INTRADAY;
    }

    private String usdKrwBackfillSessionKey(LocalDate sessionStartDate) {
        return properties.twelveData().usdKrwSymbol() + ":" + sessionStartDate;
    }

    private LocalDateTime findLatestIntradayObservedAt() {
        return jdbcTemplate.query(
            """
                SELECT MAX(observed_at)
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                """,
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toLocalDateTime(),
            properties.twelveData().usdKrwSymbol()
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private LocalDateTime findLatestIntradayObservedAt(LocalDate sessionStartDate) {
        LocalDateTime sessionStart = UsdKrwIntradaySession.startDateTime(sessionStartDate);
        LocalDateTime sessionEnd = UsdKrwIntradaySession.endDateTime(sessionStartDate);
        return jdbcTemplate.query(
            """
                SELECT MAX(observed_at)
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                  AND observed_at BETWEEN ? AND ?
                """,
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toLocalDateTime(),
            properties.twelveData().usdKrwSymbol(),
            sessionStart,
            sessionEnd
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private void recordUsdKrwBackfillAttempt(
        String sessionKey,
        LocalDate sessionStartDate,
        String status,
        int rows,
        LocalDateTime previousLatestObservedAt,
        LocalDateTime latestObservedAt,
        int noChangeCount,
        Instant attemptedAt,
        Instant nextAllowedAt,
        String message
    ) {
        jdbcTemplate.update(
            """
                INSERT INTO usd_krw_intraday_backfill_attempts
                    (session_key, currency_pair, session_start_date, status, rows_processed, previous_latest_observed_at, latest_observed_at, no_change_count, attempted_at, next_allowed_at, message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
            sessionKey,
            properties.twelveData().usdKrwSymbol(),
            sessionStartDate,
            status,
            rows,
            previousLatestObservedAt,
            latestObservedAt,
            noChangeCount,
            attemptedAt,
            nextAllowedAt,
            truncateErrorMessage(message)
        );
    }

    private UsdKrwBackfillAttempt findLatestUsdKrwBackfillAttempt(String sessionKey) {
        return jdbcTemplate.query(
            """
                SELECT session_key, session_start_date, status, rows_processed, previous_latest_observed_at, latest_observed_at, no_change_count, attempted_at, next_allowed_at, message
                FROM usd_krw_intraday_backfill_attempts
                WHERE session_key = ?
                ORDER BY attempted_at DESC, id DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new UsdKrwBackfillAttempt(
                rs.getString("session_key"),
                rs.getObject("session_start_date", LocalDate.class),
                rs.getString("status"),
                rs.getInt("rows_processed"),
                rs.getTimestamp("previous_latest_observed_at") == null ? null : rs.getTimestamp("previous_latest_observed_at").toLocalDateTime(),
                rs.getTimestamp("latest_observed_at") == null ? null : rs.getTimestamp("latest_observed_at").toLocalDateTime(),
                rs.getInt("no_change_count"),
                rs.getTimestamp("attempted_at").toInstant(),
                rs.getTimestamp("next_allowed_at") == null ? null : rs.getTimestamp("next_allowed_at").toInstant(),
                rs.getString("message")
            ),
            sessionKey
        ).stream().findFirst().orElse(null);
    }

    private BackfillSessionStatus findLatestUsdKrwBackfillAttempt() {
        return jdbcTemplate.query(
            """
                SELECT session_key, session_start_date, status, rows_processed, previous_latest_observed_at, latest_observed_at, no_change_count, attempted_at, next_allowed_at, message
                FROM usd_krw_intraday_backfill_attempts
                ORDER BY attempted_at DESC, id DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new UsdKrwBackfillAttempt(
                rs.getString("session_key"),
                rs.getObject("session_start_date", LocalDate.class),
                rs.getString("status"),
                rs.getInt("rows_processed"),
                rs.getTimestamp("previous_latest_observed_at") == null ? null : rs.getTimestamp("previous_latest_observed_at").toLocalDateTime(),
                rs.getTimestamp("latest_observed_at") == null ? null : rs.getTimestamp("latest_observed_at").toLocalDateTime(),
                rs.getInt("no_change_count"),
                rs.getTimestamp("attempted_at").toInstant(),
                rs.getTimestamp("next_allowed_at") == null ? null : rs.getTimestamp("next_allowed_at").toInstant(),
                rs.getString("message")
            )
        ).stream().findFirst().map(this::toBackfillSessionStatus).orElse(null);
    }

    private BackfillSessionStatus toBackfillSessionStatus(UsdKrwBackfillAttempt attempt) {
        String status = attempt.status();
        String message = attempt.message();
        Instant now = Instant.now();
        if (attempt.nextAllowedAt() != null && now.isBefore(attempt.nextAllowedAt())) {
            status = USD_KRW_BACKFILL_STATUS_SKIPPED_COOLDOWN;
            message = "session retry cooldown active";
        } else if (syncProperties.marketData().intradayBackfillNoChangeSuspendThreshold() > 0
            && attempt.noChangeCount() >= syncProperties.marketData().intradayBackfillNoChangeSuspendThreshold()) {
            status = USD_KRW_BACKFILL_STATUS_SKIPPED_SUSPENDED;
            message = "no-change threshold reached";
        }

        return new BackfillSessionStatus(
            attempt.sessionKey(),
            attempt.sessionStartDate(),
            status,
            attempt.rows(),
            attempt.previousLatestObservedAt(),
            attempt.latestObservedAt(),
            attempt.noChangeCount(),
            attempt.attemptedAt(),
            attempt.nextAllowedAt(),
            message
        );
    }

    private List<BusinessDayService.HolidayCalendarStatus> findHolidayCalendarStatuses() {
        if (businessDayService == null) {
            return List.of();
        }

        int year = LocalDate.now(SEOUL_ZONE).getYear();
        return businessDayService.holidayCalendarStatuses(year - 1, year + 1);
    }

    private String formatBackfillMessage(String sessionKey, String status, String message) {
        return "backfillSession=" + sessionKey + ", backfillStatus=" + status + (message == null ? "" : ", backfillMessage=" + message);
    }

    private SyncWindow currentSyncWindow(String jobName, Duration cooldown, Instant now) {
        Instant lastStartedAt = findLatestStartedAt(jobName, now);
        if (lastStartedAt == null) {
            return new SyncWindow(null, 0, true);
        }

        Instant nextAllowedAt = lastStartedAt.plus(cooldown);
        long remainingSeconds = Math.max(0, Duration.between(now, nextAllowedAt).getSeconds());
        return new SyncWindow(nextAllowedAt, remainingSeconds, remainingSeconds == 0);
    }

    private Instant findLatestStartedAt(String jobName, Instant now) {
        return jdbcTemplate.query(
            """
                SELECT started_at
                FROM batch_job_runs
                WHERE job_name = ?
                  AND (
                    status IN ('RUNNING', 'SUCCESS')
                    OR (status IN ('DEGRADED', 'FAILED_CORE_SOURCE') AND NOT EXISTS (
                        SELECT 1
                        FROM batch_job_source_runs s
                        WHERE s.batch_job_run_id = batch_job_runs.id
                          AND s.status = 'FAILED'
                          AND s.source_name IN (%s)
                    ))
                  )
                  AND (status <> 'RUNNING' OR started_at >= ?)
                ORDER BY started_at DESC
                LIMIT 1
            """.formatted(coreSourceSqlList()),
            (rs, rowNum) -> rs.getTimestamp("started_at").toInstant(),
            jobName,
            now.minus(STALE_RUNNING_TTL)
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
            (rs, rowNum) -> {
                Instant startedAt = rs.getTimestamp("started_at").toInstant();
                String status = rs.getString("status");
                if ("RUNNING".equals(status) && isStaleRunning(startedAt, Instant.now())) {
                    status = "STALE_RUNNING";
                }
                return new LatestJob(
                    status,
                    startedAt,
                    rs.getTimestamp("ended_at") == null ? null : rs.getTimestamp("ended_at").toInstant(),
                    rs.getString("message")
                );
            },
            jobName
        ).stream().findFirst().orElse(null);
    }

    private boolean canRunSource(String jobName, String sourceName, Duration cooldown, Instant now) {
        if (cooldown.isZero() || !isCoreSource(sourceName)) {
            return true;
        }

        LatestSourceRun latest = findLatestSourceRun(jobName, sourceName);
        if (latest == null || "FAILED".equals(latest.status())) {
            return true;
        }

        if (!"SUCCESS".equals(latest.status()) && !"SKIPPED_COOLDOWN".equals(latest.status())) {
            return true;
        }

        Instant nextAllowedAt = latest.startedAt().plus(cooldown);
        return !now.isBefore(nextAllowedAt);
    }

    private boolean hasRetryableFailedCoreSource(String jobName, Duration cooldown, Instant now) {
        return CORE_SOURCE_NAMES.stream()
            .filter(sourceName -> hasRecentFailedSource(jobName, sourceName, cooldown, now))
            .anyMatch(sourceName -> canRunSource(jobName, sourceName, cooldown, now));
    }

    private boolean hasRecentFailedSource(String jobName, String sourceName, Duration cooldown, Instant now) {
        LatestSourceRun latest = findLatestSourceRun(jobName, sourceName);
        if (latest == null || !"FAILED".equals(latest.status())) {
            return false;
        }

        return !latest.startedAt().plus(cooldown).isBefore(now);
    }

    private LatestSourceRun findLatestSourceRun(String jobName, String sourceName) {
        return jdbcTemplate.query(
            """
                SELECT status, started_at
                FROM batch_job_source_runs
                WHERE job_name = ?
                  AND source_name = ?
                ORDER BY started_at DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new LatestSourceRun(
                rs.getString("status"),
                rs.getTimestamp("started_at").toInstant()
            ),
            jobName,
            sourceName
        ).stream().findFirst().orElse(null);
    }

    private List<SourceRunStatus> findLatestSourceRuns(String jobName, Instant jobStartedAt) {
        return jdbcTemplate.query(
            """
                SELECT source_name, status, rows_processed, error_code, error_message, started_at, ended_at
                FROM batch_job_source_runs
                WHERE job_name = ?
                  AND started_at >= ?
                ORDER BY started_at ASC, source_name ASC
                """,
            (rs, rowNum) -> new SourceRunStatus(
                rs.getString("source_name"),
                rs.getString("status"),
                rs.getInt("rows_processed"),
                rs.getString("error_code"),
                rs.getString("error_message"),
                rs.getTimestamp("started_at").toInstant(),
                rs.getTimestamp("ended_at") == null ? null : rs.getTimestamp("ended_at").toInstant()
            ),
            jobName,
            jobStartedAt
        );
    }

    private boolean isCoreSource(String sourceName) {
        return CORE_SOURCE_NAMES.contains(sourceName);
    }

    private String syncStatus(SyncCounter counter) {
        if (counter.coreFailures > 0) {
            return "FAILED_CORE_SOURCE";
        }
        if (counter.failures > 0) {
            return "DEGRADED";
        }
        return "SUCCESS";
    }

    private String coreSourceSqlList() {
        return String.join(", ", CORE_SOURCE_NAMES.stream().map(source -> "'" + source + "'").toList());
    }

    private boolean isStaleRunning(Instant startedAt, Instant now) {
        return startedAt.plus(STALE_RUNNING_TTL).isBefore(now);
    }

    private Instant startOfTodayInSeoul() {
        return LocalDate.now(SEOUL_ZONE).atStartOfDay(SEOUL_ZONE).toInstant();
    }

    private Instant startOfCurrentMonthInSeoul() {
        return YearMonth.now(SEOUL_ZONE).atDay(1).atStartOfDay(SEOUL_ZONE).toInstant();
    }

    private boolean hasMajorExchangeRateCoverageForDate(LocalDate baseDate) {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(DISTINCT currency_code)
                FROM exchange_rates
                WHERE base_date = ?
                  AND (
                    currency_code = 'USD'
                    OR currency_code LIKE 'JPY%'
                    OR currency_code LIKE 'EUR%'
                    OR currency_code LIKE 'CNH%'
                    OR currency_code LIKE 'CNY%'
                    OR currency_code LIKE 'GBP%'
                    OR currency_code LIKE 'AUD%'
                    OR currency_code LIKE 'CAD%'
                    OR currency_code LIKE 'CHF%'
                    OR currency_code LIKE 'HKD%'
                    OR currency_code LIKE 'SGD%'
                  )
                """,
            Integer.class,
            baseDate
        );
        return count != null && count >= MAJOR_EXCHANGE_RATE_PREFIXES.size() - 1;
    }

    private boolean hasRecentInterestRateFetch(String countryCode, String rateType, Instant threshold) {
        return hasRecentFetch(
            """
                SELECT COUNT(*)
                FROM interest_rates
                WHERE country_code = ?
                  AND rate_type = ?
                  AND fetched_at >= ?
                """,
            countryCode,
            rateType,
            threshold
        );
    }

    private boolean hasInterestRateCoverage(String countryCode, String rateType, LocalDate targetStartDate) {
        LocalDate earliestDate = findEarliestInterestRateDate(countryCode, rateType);
        return earliestDate != null && !earliestDate.isAfter(targetStartDate.plusDays(45));
    }

    private boolean hasRecentDomesticPolicyFetch(String indicatorCode, Instant threshold) {
        return hasRecentFetch(
            """
                SELECT COUNT(*)
                FROM domestic_policy_indicators
                WHERE indicator_code = ?
                  AND fetched_at >= ?
                """,
            indicatorCode,
            threshold
        );
    }

    private boolean hasDomesticPolicyCoverage(String indicatorCode, LocalDate targetStartDate) {
        LocalDate earliestDate = findEarliestDomesticPolicyDate(indicatorCode);
        return earliestDate != null && !earliestDate.isAfter(targetStartDate.plusDays(45));
    }

    private boolean hasRecentTableFetch(String tableName, Instant threshold) {
        if (!Set.of("effective_exchange_rates", "foreign_reserves").contains(tableName)) {
            throw new IllegalArgumentException("Unsupported freshness table: " + tableName);
        }

        return hasRecentFetch("SELECT COUNT(*) FROM " + tableName + " WHERE fetched_at >= ?", threshold);
    }

    private boolean hasSuccessfulSourceRunSince(String jobName, String sourceName, Instant threshold) {
        return hasRecentFetch(
            """
                SELECT COUNT(*)
                FROM batch_job_source_runs
                WHERE job_name = ?
                  AND source_name = ?
                  AND status = 'SUCCESS'
                  AND started_at >= ?
                """,
            jobName,
            sourceName,
            threshold
        );
    }

    private boolean hasRecentFetch(String sql, Object... params) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, params);
        return count != null && count > 0;
    }

    private static class SyncCounter {
        private int failures;
        private int coreFailures;
        private int skippedSources;
        private String message = "";
    }

    private enum SyncTrigger {
        MANUAL,
        SCHEDULED,
        INTRADAY,
        SCHEDULED_INTRADAY,
        DAILY_BACKFILL,
        EXCHANGE_RATE_HISTORY_BACKFILL,
        SCHEDULED_DAILY_BACKFILL,
        SCHEDULED_CURRENT_EXCHANGE,
        SCHEDULED_CURRENCY_STRENGTH
    }

    private record SyncWindow(Instant nextAllowedAt, long remainingCooldownSeconds, boolean canSync) {
    }

    private record LatestJob(String status, Instant startedAt, Instant endedAt, String message) {
    }

    private record LatestSourceRun(String status, Instant startedAt) {
    }

    private record IntradaySyncOutcome(int rows, String message) {
    }

    private record BackfillFetchOutcome(List<TwelveDataClient.IntradayExchangePayload> observations, int rows, String message) {
    }

    private record BackfillSessionDecision(
        boolean canAttempt,
        String sessionKey,
        String status,
        LocalDateTime latestObservedAt,
        int noChangeCount,
        Instant nextAllowedAt,
        String message
    ) {
    }

    private record UsdKrwBackfillAttempt(
        String sessionKey,
        LocalDate sessionStartDate,
        String status,
        int rows,
        LocalDateTime previousLatestObservedAt,
        LocalDateTime latestObservedAt,
        int noChangeCount,
        Instant attemptedAt,
        Instant nextAllowedAt,
        String message
    ) {
    }

    private String toEcosQuarter(YearMonth month) {
        int quarter = (month.getMonthValue() - 1) / 3 + 1;
        return month.getYear() + "Q" + quarter;
    }

    private record DomesticPolicySpec(String code, String title, String category, String statCode, String itemCode, String unit, String source) {
    }

    private record LatestExchangeRate(LocalDate baseDate, BigDecimal rate) {
    }

    private record TwelveDataExchangeSpec(String symbol, String currencyCode, String currencyName, BigDecimal displayUnit) {

        private BigDecimal toDisplayRate(BigDecimal rate) {
            return rate.multiply(displayUnit).setScale(4, RoundingMode.HALF_UP);
        }
    }

    private record TwelveDataExchangeCandidate(TwelveDataExchangeSpec spec, Instant latestFetchedAt) {
    }

    private record FredExchangeSpec(String currencyCode, String currencyName, String seriesId, boolean usdPerForeignUnit, BigDecimal displayUnit) {

        private BigDecimal toKrwRate(BigDecimal usdKrwRate, BigDecimal fredRate) {
            if (usdPerForeignUnit) {
                return usdKrwRate.multiply(fredRate).multiply(displayUnit).setScale(4, RoundingMode.HALF_UP);
            }

            return usdKrwRate.divide(fredRate, 8, RoundingMode.HALF_UP).multiply(displayUnit).setScale(4, RoundingMode.HALF_UP);
        }
    }

    public record SyncResult(
        int exchangeRateRows,
        int intradayExchangeRateRows,
        int dollarIndexRows,
        int currencyStrengthRows,
        int usPolicyRateRows,
        int krPolicyRateRows,
        int foreignReserveRows,
        int domesticPolicyRows,
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
        boolean canSync,
        List<SourceRunStatus> sourceRuns,
        BackfillSessionStatus backfillSession,
        List<BusinessDayService.HolidayCalendarStatus> holidayCalendars
    ) {
    }

    public record SourceRunStatus(
        String sourceName,
        String status,
        int rows,
        String errorCode,
        String errorMessage,
        Instant startedAt,
        Instant endedAt
    ) {
    }

    public record BackfillSessionStatus(
        String sessionKey,
        LocalDate sessionStartDate,
        String status,
        int rows,
        LocalDateTime previousLatestObservedAt,
        LocalDateTime latestObservedAt,
        int noChangeCount,
        Instant attemptedAt,
        Instant nextAllowedAt,
        String message
    ) {
    }
}
