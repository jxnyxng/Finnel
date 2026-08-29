package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.example.krwwatcher.config.DashboardCacheProperties;
import com.example.krwwatcher.config.ExternalApiProperties;
import com.example.krwwatcher.domain.DollarIndex;
import com.example.krwwatcher.domain.ExchangeRate;
import com.example.krwwatcher.domain.ForeignReserve;
import com.example.krwwatcher.domain.InterestRate;
import com.example.krwwatcher.external.FredClient;
import com.example.krwwatcher.repository.DollarIndexRepository;
import com.example.krwwatcher.repository.ExchangeRateRepository;
import com.example.krwwatcher.repository.ForeignReserveRepository;
import com.example.krwwatcher.repository.InterestRateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private final ExternalApiProperties properties;
    private final ExchangeRateRepository exchangeRateRepository;
    private final DollarIndexRepository dollarIndexRepository;
    private final InterestRateRepository interestRateRepository;
    private final ForeignReserveRepository foreignReserveRepository;
    private final JdbcTemplate jdbcTemplate;
    private final DailyDashboardCache dailyDashboardCache;
    private final FredClient fredClient;
    private final DashboardForeignExchangeMapper foreignExchangeMapper = new DashboardForeignExchangeMapper();
    private final DashboardDomesticIndicatorMetadata indicatorMetadata = new DashboardDomesticIndicatorMetadata();
    private final DashboardMetricCalculator metricCalculator = new DashboardMetricCalculator();
    private final DashboardSourceMapper sourceMapper = new DashboardSourceMapper();
    private final DashboardFreshnessPolicy freshnessPolicy = new DashboardFreshnessPolicy();
    private final DashboardIntradaySeriesMapper intradaySeriesMapper = new DashboardIntradaySeriesMapper();
    private final DashboardDataSourceInfoProvider dataSourceInfoProvider = new DashboardDataSourceInfoProvider();
    private final DashboardDomesticIndicatorAssembler domesticIndicatorAssembler;

    @Autowired
    public DashboardService(
        ExternalApiProperties properties,
        ExchangeRateRepository exchangeRateRepository,
        DollarIndexRepository dollarIndexRepository,
        InterestRateRepository interestRateRepository,
        ForeignReserveRepository foreignReserveRepository,
        JdbcTemplate jdbcTemplate,
        FredClient fredClient,
        DashboardCacheProperties dashboardCacheProperties
    ) {
        this.properties = properties;
        this.exchangeRateRepository = exchangeRateRepository;
        this.dollarIndexRepository = dollarIndexRepository;
        this.interestRateRepository = interestRateRepository;
        this.foreignReserveRepository = foreignReserveRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.fredClient = fredClient;
        this.dailyDashboardCache = new DailyDashboardCache(dashboardCacheProperties);
        this.domesticIndicatorAssembler = new DashboardDomesticIndicatorAssembler(
            exchangeRateRepository,
            interestRateRepository,
            foreignReserveRepository,
            jdbcTemplate,
            indicatorMetadata,
            metricCalculator,
            sourceMapper,
            freshnessPolicy
        );
    }

    public DashboardService(
        ExternalApiProperties properties,
        ExchangeRateRepository exchangeRateRepository,
        DollarIndexRepository dollarIndexRepository,
        InterestRateRepository interestRateRepository,
        ForeignReserveRepository foreignReserveRepository,
        JdbcTemplate jdbcTemplate
    ) {
        this(properties, exchangeRateRepository, dollarIndexRepository, interestRateRepository, foreignReserveRepository, jdbcTemplate, null, DashboardCacheProperties.defaults());
    }

    @Transactional(readOnly = true)
    public DailyDashboardResponse daily() {
        return dailyDashboardCache.get(this::buildDailyDashboardResponse);
    }

    private DailyDashboardResponse buildDailyDashboardResponse() {
        DollarIndex latestDollarIndex = dollarIndexRepository.findTopBySeriesIdOrderByBaseDateDesc(properties.fred().dollarIndexSeriesId()).orElse(null);
        DollarIndex latestAdvancedDollarIndex = dollarIndexRepository.findTopBySeriesIdOrderByBaseDateDesc(properties.fred().advancedDollarIndexSeriesId()).orElse(null);
        InterestRate latestUsRate = interestRateRepository.findTopByCountryCodeAndRateTypeOrderByBaseDateDesc("US", "POLICY_RATE").orElse(null);
        InterestRate latestKrRate = interestRateRepository.findTopByCountryCodeAndRateTypeOrderByBaseDateDesc("KR", "POLICY_RATE").orElse(null);
        ForeignReserve latestForeignReserve = foreignReserveRepository.findTopByOrderByBaseDateDesc().orElse(null);
        ExchangeRate latestUsdKrwDaily = exchangeRateRepository.findTopByCurrencyCodeOrderByBaseDateDesc("USD").orElse(null);

        List<TimeSeriesPoint> usdKrwDailySeries = exchangeRateRepository
            .findByCurrencyCodeAndBaseDateGreaterThanEqualOrderByBaseDateAsc("USD", LocalDate.now().minusYears(5))
            .stream()
            .filter(item -> isWeekday(item.getBaseDate()))
            .map(item -> new TimeSeriesPoint(item.getBaseDate(), item.getDealBasRate()))
            .toList();

        List<TimeSeriesPoint> dollarIndexSeries = dollarIndexRepository
            .findBySeriesIdAndBaseDateGreaterThanEqualOrderByBaseDateAsc(properties.fred().dollarIndexSeriesId(), LocalDate.now().minusYears(5))
            .stream()
            .map(item -> new TimeSeriesPoint(item.getBaseDate(), item.getValue()))
            .toList();

        List<TimeSeriesPoint> advancedDollarIndexSeries = dollarIndexRepository
            .findBySeriesIdAndBaseDateGreaterThanEqualOrderByBaseDateAsc(properties.fred().advancedDollarIndexSeriesId(), LocalDate.now().minusYears(5))
            .stream()
            .map(item -> new TimeSeriesPoint(item.getBaseDate(), item.getValue()))
            .toList();

        List<IntradayTimeSeriesPoint> usdKrwIntradaySeries = findLatestIntradaySeries();
        List<IntradayCandlestickPoint> usdKrwIntradayCandles = intradaySeriesMapper.buildFiveMinuteIntradayCandles(usdKrwIntradaySeries);
        List<TimeSeriesPoint> usdKrwSeries = intradaySeriesMapper.mergeLatestIntradayPoint(usdKrwDailySeries, usdKrwIntradaySeries);
        List<CurrencyStrengthRank> currencyStrengthRanks = findCurrencyStrengthRanks();
        List<ForeignExchangeRate> foreignExchangeRates = findForeignExchangeRates();

        TimeSeriesPoint latestUsdKrw = usdKrwSeries.isEmpty() ? null : usdKrwSeries.get(usdKrwSeries.size() - 1);
        LocalDate baseDate = latestUsdKrw != null ? latestUsdKrw.baseDate() : LocalDate.now();
        List<DomesticIndicator> domesticIndicators = domesticIndicators(latestUsdKrw, latestUsdKrwDaily, usdKrwIntradaySeries, latestKrRate, latestUsRate, latestForeignReserve);
        DashboardFreshnessInfo dashboardFreshness = aggregateFreshness(domesticIndicators);

        return new DailyDashboardResponse(
            baseDate,
            List.of(
                metric("USD/KRW", "원/달러 환율", latestUsdKrw == null ? null : latestUsdKrw.value(), "KRW", metricCalculator.changeRate(usdKrwSeries)),
                metric("ADVANCED_DOLLAR_INDEX", "주요 7개 통화권 달러인덱스", latestAdvancedDollarIndex == null ? null : latestAdvancedDollarIndex.getValue(), "INDEX", metricCalculator.changeRate(advancedDollarIndexSeries)),
                metric("BROAD_DOLLAR_INDEX", "26개 교역 상대 달러인덱스", latestDollarIndex == null ? null : latestDollarIndex.getValue(), "INDEX", metricCalculator.changeRate(dollarIndexSeries)),
                metric("US_POLICY_RATE", "미국 기준금리", latestUsRate == null ? null : latestUsRate.getRateValue(), "PERCENT"),
                metric("KR_POLICY_RATE", "한국 기준금리", latestKrRate == null ? null : latestKrRate.getRateValue(), "PERCENT"),
                metric("KR_US_RATE_GAP", "한미 기준금리차", rateGap(latestUsRate, latestKrRate), "PERCENT_POINT"),
                metric("FOREIGN_RESERVES", "대한민국 외환보유액", latestForeignReserve == null ? null : latestForeignReserve.getAmountUsdMillion(), "USD_MILLION")
            ),
            usdKrwSeries,
            usdKrwIntradaySeries,
            usdKrwIntradayCandles,
            advancedDollarIndexSeries,
            dollarIndexSeries,
            dollarIndexStatus(latestAdvancedDollarIndex, properties.fred().advancedDollarIndexSeriesId()),
            dollarIndexStatus(latestDollarIndex, properties.fred().dollarIndexSeriesId()),
            currencyStrengthRanks,
            foreignExchangeRates,
            exchangeRateCalculatorMeta(foreignExchangeRates),
            domesticIndicators,
            dataSourceInfoProvider.dataSourceInfos(),
            dashboardFreshness.freshnessStatus(),
            dashboardFreshness.staleReason(),
            dashboardFreshness.expectedNextUpdateAt(),
            dashboardFreshness.lastSuccessfulFetchedAt()
        );
    }

    public ExchangeRateSnapshotResponse exchangeRateSnapshot(String currencyCode, LocalDate date) {
        return new ExchangeRateSnapshotResponse(
            currencyCode,
            date,
            findForeignExchangeRateAtOrBefore(currencyCode, date),
            findLatestForeignExchangeRate(currencyCode)
        );
    }

    public DomesticIndicatorHistoryResponse domesticIndicatorHistory(String code, String range) {
        LocalDate endDate = LocalDate.now(SEOUL_ZONE);
        List<HistoryRange> availableRanges = availableHistoryRanges(code, endDate);
        HistoryRange requestedRange = HistoryRange.from(range);
        HistoryRange historyRange = availableRanges.contains(requestedRange)
            ? requestedRange
            : availableRanges.stream().reduce((first, second) -> second).orElse(requestedRange);
        LocalDate startDate = endDate.minusYears(historyRange.years());
        List<TimeSeriesPoint> points = findDomesticIndicatorHistoryPoints(code, startDate, endDate);
        LocalDate responseEndDate = points.isEmpty() ? endDate : points.get(points.size() - 1).baseDate();
        DomesticIndicatorMetadata metadata = domesticIndicatorMetadata(code);
        BigDecimal averageValue = metricCalculator.average(points);

        return new DomesticIndicatorHistoryResponse(
            code,
            metadata.title(),
            metadata.unit(),
            historyRange.key(),
            startDate,
            responseEndDate,
            averageValue,
            availableRanges.stream().map(HistoryRange::key).toList(),
            points
        );
    }

    private List<DomesticIndicator> domesticIndicators(
        TimeSeriesPoint latestUsdKrw,
        ExchangeRate latestUsdKrwDaily,
        List<IntradayTimeSeriesPoint> usdKrwIntradaySeries,
        InterestRate latestKrRate,
        InterestRate latestUsRate,
        ForeignReserve latestForeignReserve
    ) {
        return domesticIndicatorAssembler.domesticIndicators(
            latestUsdKrw,
            latestUsdKrwDaily,
            usdKrwIntradaySeries,
            latestKrRate,
            latestUsRate,
            latestForeignReserve
        );
    }

    private List<DomesticIndicator> domesticPolicyIndicators() {
        return domesticIndicatorAssembler.domesticPolicyIndicators();
    }

    private DomesticIndicator domesticPolicyIndicator(String code) {
        return domesticIndicatorAssembler.domesticPolicyIndicator(code);
    }

    private List<IntradayTimeSeriesPoint> findLatestIntradaySeries() {
        LocalDate activeSessionStartDate = UsdKrwIntradaySession.activeSessionStartDate(LocalDateTime.now(SEOUL_ZONE));
        if (activeSessionStartDate != null) {
            List<IntradayTimeSeriesPoint> activeSession = findIntradaySeries(activeSessionStartDate);
            if (!activeSession.isEmpty()) {
                return activeSession;
            }
        }

        LocalDate latestStoredSessionStartDate = findLatestStoredIntradaySessionStartDate();
        if (latestStoredSessionStartDate == null) {
            return List.of();
        }

        return findIntradaySeries(latestStoredSessionStartDate);
    }

    private List<IntradayTimeSeriesPoint> findIntradaySeries(LocalDate currentDisplaySessionStartDate) {
        LocalDateTime sessionStart = UsdKrwIntradaySession.startDateTime(currentDisplaySessionStartDate);
        LocalDateTime sessionEnd = UsdKrwIntradaySession.endDateTime(currentDisplaySessionStartDate);
        return jdbcTemplate.query(
            """
                SELECT observed_at, open_rate, high_rate, low_rate, close_rate, fetched_at
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                  AND observed_at BETWEEN ? AND ?
                ORDER BY observed_at ASC
                """,
            (rs, rowNum) -> new IntradayTimeSeriesPoint(
                toSeoulInstant(rs.getObject("observed_at", LocalDateTime.class)),
                rs.getBigDecimal("open_rate"),
                rs.getBigDecimal("high_rate"),
                rs.getBigDecimal("low_rate"),
                rs.getBigDecimal("close_rate"),
                rs.getTimestamp("fetched_at").toInstant()
            ),
            properties.twelveData().usdKrwSymbol(),
            sessionStart,
            sessionEnd
        );
    }

    private LocalDate findLatestStoredIntradaySessionStartDate() {
        LocalDateTime latestObservedAt = jdbcTemplate.query(
            """
                SELECT MAX(observed_at)
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                """,
            (rs, rowNum) -> rs.getObject(1, LocalDateTime.class),
            properties.twelveData().usdKrwSymbol()
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
        if (latestObservedAt == null) {
            return null;
        }

        return UsdKrwIntradaySession.sessionStartDate(latestObservedAt);
    }

    private MetricSnapshot metric(String code, String label, BigDecimal value, String unit) {
        return new MetricSnapshot(code, label, value, unit, null);
    }

    private MetricSnapshot metric(String code, String label, BigDecimal value, String unit, BigDecimal changeRate) {
        return new MetricSnapshot(code, label, value, unit, changeRate);
    }

    private Instant toSeoulInstant(LocalDateTime localDateTime) {
        return localDateTime.atZone(SEOUL_ZONE).toInstant();
    }

    private DashboardFreshnessInfo aggregateFreshness(List<DomesticIndicator> indicators) {
        return freshnessPolicy.aggregateFreshness(indicators);
    }

    private List<TimeSeriesPoint> findDomesticIndicatorHistoryPoints(String code, LocalDate startDate, LocalDate endDate) {
        return switch (code) {
            case "USD_KRW" -> mergeLatestUsdKrwIntradayHistoryPoint(
                jdbcTemplate.query(
                    """
                        SELECT base_date, deal_bas_rate
                        FROM exchange_rates
                        WHERE currency_code = ?
                          AND base_date >= ?
                          AND base_date <= ?
                        ORDER BY base_date ASC
                        """,
                    (rs, rowNum) -> new TimeSeriesPoint(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("deal_bas_rate")),
                    "USD",
                    startDate,
                    endDate
                ).stream().filter(point -> isWeekday(point.baseDate())).toList(),
                startDate,
                endDate
            );
            case "KR_POLICY_RATE" -> findInterestRateHistory("KR", "POLICY_RATE", startDate, endDate);
            case "US_POLICY_RATE" -> findInterestRateHistory("US", "POLICY_RATE", startDate, endDate);
            case "KR_US_RATE_GAP" -> findRateGapHistory(startDate, endDate);
            case "FOREIGN_RESERVES" -> jdbcTemplate.query(
                """
                    SELECT base_date, amount_usd_million
                    FROM foreign_reserves
                    WHERE base_date >= ?
                      AND base_date <= ?
                    ORDER BY base_date ASC
                    """,
                (rs, rowNum) -> new TimeSeriesPoint(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("amount_usd_million")),
                startDate,
                endDate
            );
            case "KR_NEER_RANK" -> findKrwNeerRankHistory(startDate, endDate);
            case "US_TREASURY_1MO", "US_TREASURY_3MO", "US_TREASURY_6MO", "US_TREASURY_1Y", "US_TREASURY_2Y",
                "US_TREASURY_3Y", "US_TREASURY_5Y", "US_TREASURY_7Y", "US_10Y_TREASURY",
                "US_TREASURY_20Y", "US_TREASURY_30Y", "SOFR", "SOFR_30D_AVG", "SOFR_90D_AVG",
                "SOFR_180D_AVG", "SOFR_INDEX", "KOFR", "CD_91D", "M2", "CURRENT_ACCOUNT",
                "GOODS_ACCOUNT", "CPI", "PPI", "EXPORT_AMOUNT", "IMPORT_AMOUNT",
                "TRADE_BALANCE", "RESERVES_TO_SHORT_TERM_DEBT", "SHORT_TERM_EXTERNAL_DEBT",
                "FISCAL_BALANCE", "GOVERNMENT_DEBT", "FOREIGN_STOCK_FLOW",
                "FOREIGN_BOND_FLOW", "TERMS_OF_TRADE", "VIX",
                "WTI_OIL", "GLOBAL_CREDIT_SPREAD_PROXY", "KOREA_CDS" -> jdbcTemplate.query(
                    """
                        SELECT base_date, value
                        FROM domestic_policy_indicators
                        WHERE indicator_code = ?
                          AND base_date >= ?
                          AND base_date <= ?
                        ORDER BY base_date ASC
                        """,
                    (rs, rowNum) -> new TimeSeriesPoint(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("value")),
                    code,
                    startDate,
                    endDate
                );
            default -> throw new IllegalArgumentException("Unsupported domestic indicator code: " + code);
        };
    }

    private List<TimeSeriesPoint> mergeLatestUsdKrwIntradayHistoryPoint(List<TimeSeriesPoint> dailyPoints, LocalDate startDate, LocalDate endDate) {
        TimeSeriesPoint latestIntradayPoint = findLatestUsdKrwIntradayHistoryPoint(startDate, endDate);
        if (latestIntradayPoint == null) {
            return dailyPoints;
        }

        if (dailyPoints.isEmpty()) {
            return List.of(latestIntradayPoint);
        }

        TimeSeriesPoint latestDailyPoint = dailyPoints.get(dailyPoints.size() - 1);
        List<TimeSeriesPoint> mergedPoints = new ArrayList<>(dailyPoints);
        if (latestIntradayPoint.baseDate().isAfter(latestDailyPoint.baseDate())) {
            mergedPoints.add(latestIntradayPoint);
        } else if (latestIntradayPoint.baseDate().isEqual(latestDailyPoint.baseDate())) {
            mergedPoints.set(mergedPoints.size() - 1, latestIntradayPoint);
        }

        return mergedPoints;
    }

    private TimeSeriesPoint findLatestUsdKrwIntradayHistoryPoint(LocalDate startDate, LocalDate endDate) {
        return jdbcTemplate.query(
            """
                SELECT DATE(observed_at) AS base_date, close_rate
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                  AND DATE(observed_at) >= ?
                  AND DATE(observed_at) <= ?
                ORDER BY observed_at DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new TimeSeriesPoint(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("close_rate")),
            "USD/KRW",
            startDate,
            endDate
        ).stream().findFirst().orElse(null);
    }

    private boolean isWeekday(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        return dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY;
    }

    private List<TimeSeriesPoint> findInterestRateHistory(String countryCode, String rateType, LocalDate startDate, LocalDate endDate) {
        return jdbcTemplate.query(
            """
                SELECT base_date, rate_value
                FROM interest_rates
                WHERE country_code = ?
                  AND rate_type = ?
                  AND base_date >= ?
                  AND base_date <= ?
                ORDER BY base_date ASC
                """,
            (rs, rowNum) -> new TimeSeriesPoint(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("rate_value")),
            countryCode,
            rateType,
            startDate,
            endDate
        );
    }

    private List<TimeSeriesPoint> findRateGapHistory(LocalDate startDate, LocalDate endDate) {
        return jdbcTemplate.query(
            """
                SELECT us.base_date, us.rate_value - kr.rate_value AS value
                FROM interest_rates us
                JOIN interest_rates kr
                  ON kr.country_code = 'KR'
                 AND kr.rate_type = 'POLICY_RATE'
                 AND kr.base_date = (
                    SELECT MAX(base_date)
                    FROM interest_rates
                    WHERE country_code = 'KR'
                      AND rate_type = 'POLICY_RATE'
                      AND base_date <= us.base_date
                 )
                WHERE us.country_code = 'US'
                  AND us.rate_type = 'POLICY_RATE'
                  AND us.base_date >= ?
                  AND us.base_date <= ?
                ORDER BY us.base_date ASC
                """,
            (rs, rowNum) -> new TimeSeriesPoint(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("value")),
            startDate,
            endDate
        );
    }

    private List<TimeSeriesPoint> findKrwNeerRankHistory(LocalDate startDate, LocalDate endDate) {
        return jdbcTemplate.query(
            """
                SELECT ranked.base_date, ranked.neer_rank
                FROM (
                    SELECT base_date, area_code, ROW_NUMBER() OVER (PARTITION BY base_date ORDER BY value ASC) AS neer_rank
                    FROM effective_exchange_rates
                    WHERE index_type = 'NEER'
                      AND basket_type = 'BROAD'
                      AND base_date >= ?
                      AND base_date <= ?
                ) ranked
                WHERE ranked.area_code = 'KR'
                ORDER BY ranked.base_date ASC
                """,
            (rs, rowNum) -> new TimeSeriesPoint(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("neer_rank")),
            startDate,
            endDate
        );
    }

    private DomesticIndicatorMetadata domesticIndicatorMetadata(String code) {
        return domesticIndicatorAssembler.domesticIndicatorMetadata(code);
    }

    private List<HistoryRange> availableHistoryRanges(String code, LocalDate endDate) {
        LocalDate earliestDate = findEarliestDomesticIndicatorHistoryDate(code);
        if (earliestDate == null) {
            return List.of();
        }

        return List.of(HistoryRange.ONE_YEAR, HistoryRange.THREE_YEARS, HistoryRange.FIVE_YEARS).stream()
            .filter(range -> !earliestDate.isAfter(endDate.minusYears(range.years()).plusDays(45)))
            .toList();
    }

    private LocalDate findEarliestDomesticIndicatorHistoryDate(String code) {
        return switch (code) {
            case "USD_KRW" -> queryEarliestDate(
                """
                    SELECT MIN(base_date)
                    FROM exchange_rates
                    WHERE currency_code = ?
                    """,
                "USD"
            );
            case "KR_POLICY_RATE" -> findEarliestInterestRateDate("KR", "POLICY_RATE");
            case "US_POLICY_RATE" -> findEarliestInterestRateDate("US", "POLICY_RATE");
            case "KR_US_RATE_GAP" -> queryEarliestDate(
                """
                    SELECT MIN(us.base_date)
                    FROM interest_rates us
                    WHERE us.country_code = 'US'
                      AND us.rate_type = 'POLICY_RATE'
                      AND EXISTS (
                        SELECT 1
                        FROM interest_rates kr
                        WHERE kr.country_code = 'KR'
                          AND kr.rate_type = 'POLICY_RATE'
                          AND kr.base_date <= us.base_date
                      )
                    """
            );
            case "FOREIGN_RESERVES" -> queryEarliestDate("SELECT MIN(base_date) FROM foreign_reserves");
            case "KR_NEER_RANK" -> queryEarliestDate(
                """
                    SELECT MIN(base_date)
                    FROM effective_exchange_rates
                    WHERE index_type = 'NEER'
                      AND basket_type = 'BROAD'
                      AND area_code = 'KR'
                    """
            );
            case "US_TREASURY_1MO", "US_TREASURY_3MO", "US_TREASURY_6MO", "US_TREASURY_1Y", "US_TREASURY_2Y",
                "US_TREASURY_3Y", "US_TREASURY_5Y", "US_TREASURY_7Y", "US_10Y_TREASURY",
                "US_TREASURY_20Y", "US_TREASURY_30Y", "SOFR", "SOFR_30D_AVG", "SOFR_90D_AVG",
                "SOFR_180D_AVG", "SOFR_INDEX", "KOFR", "CD_91D", "M2", "CURRENT_ACCOUNT",
                "GOODS_ACCOUNT", "CPI", "PPI", "EXPORT_AMOUNT", "IMPORT_AMOUNT",
                "TRADE_BALANCE", "RESERVES_TO_SHORT_TERM_DEBT", "SHORT_TERM_EXTERNAL_DEBT",
                "FISCAL_BALANCE", "GOVERNMENT_DEBT", "FOREIGN_STOCK_FLOW",
                "FOREIGN_BOND_FLOW", "TERMS_OF_TRADE", "VIX",
                "WTI_OIL", "GLOBAL_CREDIT_SPREAD_PROXY", "KOREA_CDS" -> queryEarliestDate(
                    """
                        SELECT MIN(base_date)
                        FROM domestic_policy_indicators
                        WHERE indicator_code = ?
                        """,
                    code
                );
            default -> throw new IllegalArgumentException("Unsupported domestic indicator code: " + code);
        };
    }

    private LocalDate findEarliestInterestRateDate(String countryCode, String rateType) {
        return queryEarliestDate(
            """
                SELECT MIN(base_date)
                FROM interest_rates
                WHERE country_code = ?
                  AND rate_type = ?
                """,
            countryCode,
            rateType
        );
    }

    private LocalDate queryEarliestDate(String sql, Object... params) {
        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            params
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private List<CurrencyStrengthRank> findCurrencyStrengthRanks() {
        LocalDate latestNeerDate = jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM effective_exchange_rates
                WHERE index_type = 'NEER'
                  AND basket_type = 'BROAD'
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate()
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);

        if (latestNeerDate == null) {
            return List.of();
        }
        LocalDate previousNeerDate = jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM effective_exchange_rates
                WHERE index_type = 'NEER'
                  AND basket_type = 'BROAD'
                  AND base_date < ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            latestNeerDate
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);

        LocalDate latestReerDate = jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM effective_exchange_rates
                WHERE index_type = 'REER'
                  AND basket_type = 'BROAD'
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate()
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);

        Map<String, BigDecimal> latestReerByArea = latestReerDate == null ? Map.of() : jdbcTemplate.query(
            """
                SELECT area_code, value
                FROM effective_exchange_rates
                WHERE index_type = 'REER'
                  AND basket_type = 'BROAD'
                  AND base_date = ?
                """,
            rs -> {
                Map<String, BigDecimal> values = new LinkedHashMap<>();
                while (rs.next()) {
                    values.put(rs.getString("area_code"), rs.getBigDecimal("value"));
                }
                return values;
            },
            latestReerDate
        );

        List<EffectiveExchangeRateRow> rows = jdbcTemplate.query(
            """
                SELECT base_date, area_code, area_name, value, fetched_at
                FROM effective_exchange_rates
                WHERE index_type = 'NEER'
                  AND basket_type = 'BROAD'
                  AND base_date = ?
                """,
            (rs, rowNum) -> new EffectiveExchangeRateRow(
                rs.getDate("base_date").toLocalDate(),
                rs.getString("area_code"),
                rs.getString("area_name"),
                rs.getBigDecimal("value"),
                rs.getTimestamp("fetched_at").toInstant()
            ),
            latestNeerDate
        ).stream()
            .sorted(Comparator.comparing(EffectiveExchangeRateRow::value))
            .toList();

        int totalCount = rows.size();
        Map<String, Integer> previousRankByArea = previousNeerDate == null ? Map.of() : findNeerRankByArea(previousNeerDate);
        Map<String, BigDecimal> previousValueByArea = previousNeerDate == null ? Map.of() : findNeerValueByArea(previousNeerDate);
        List<CurrencyStrengthRank> ranks = new ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            EffectiveExchangeRateRow row = rows.get(index);
            Integer previousRank = previousRankByArea.get(row.areaCode());
            BigDecimal previousValue = previousValueByArea.get(row.areaCode());
            ranks.add(new CurrencyStrengthRank(
                row.baseDate(),
                row.areaCode(),
                row.areaName(),
                row.value(),
                index + 1,
                totalCount,
                latestReerDate,
                latestReerByArea.get(row.areaCode()),
                previousRank,
                previousValue,
                previousValue == null ? null : row.value().subtract(previousValue),
                row.fetchedAt()
            ));
        }
        return ranks;
    }

    private Map<String, Integer> findNeerRankByArea(LocalDate baseDate) {
        List<EffectiveExchangeRateRow> rows = findNeerRows(baseDate);
        Map<String, Integer> rankByArea = new LinkedHashMap<>();
        for (int index = 0; index < rows.size(); index++) {
            rankByArea.put(rows.get(index).areaCode(), index + 1);
        }
        return rankByArea;
    }

    private Map<String, BigDecimal> findNeerValueByArea(LocalDate baseDate) {
        return findNeerRows(baseDate).stream()
            .collect(java.util.stream.Collectors.toMap(
                EffectiveExchangeRateRow::areaCode,
                EffectiveExchangeRateRow::value,
                (left, right) -> left,
                LinkedHashMap::new
            ));
    }

    private List<EffectiveExchangeRateRow> findNeerRows(LocalDate baseDate) {
        return jdbcTemplate.query(
            """
                SELECT base_date, area_code, area_name, value, fetched_at
                FROM effective_exchange_rates
                WHERE index_type = 'NEER'
                  AND basket_type = 'BROAD'
                  AND base_date = ?
                """,
            (rs, rowNum) -> new EffectiveExchangeRateRow(
                rs.getDate("base_date").toLocalDate(),
                rs.getString("area_code"),
                rs.getString("area_name"),
                rs.getBigDecimal("value"),
                rs.getTimestamp("fetched_at").toInstant()
            ),
            baseDate
        ).stream()
            .sorted(Comparator.comparing(EffectiveExchangeRateRow::value))
            .toList();
    }

    private List<ForeignExchangeRate> findForeignExchangeRates() {
        List<ForeignExchangeRate> rows = new ArrayList<>();
        rows.addAll(findCurrentForeignExchangeRates());
        rows.addAll(findLatestDailyForeignExchangeRatesExcludingCurrent());

        return rows.stream()
            .sorted(Comparator.comparingInt(row -> foreignExchangeMapper.order(row.displayCode())))
            .toList();
    }

    private List<ForeignExchangeRate> findCurrentForeignExchangeRates() {
        return jdbcTemplate.query(
            """
                SELECT ce.base_date, ce.currency_code, ce.currency_name, ce.deal_bas_rate, ce.source, ce.fetched_at,
                       coverage.history_start_date, coverage.history_end_date
                FROM current_exchange_rates ce
                LEFT JOIN (
                    SELECT currency_code, MIN(base_date) AS history_start_date, MAX(base_date) AS history_end_date
                    FROM exchange_rates
                    GROUP BY currency_code
                ) coverage
                  ON coverage.currency_code = ce.currency_code
                WHERE (
                    ce.currency_code = 'USD'
                    OR ce.currency_code LIKE 'JPY%'
                    OR ce.currency_code LIKE 'EUR%'
                    OR ce.currency_code LIKE 'CNY%'
                    OR ce.currency_code LIKE 'CNH%'
                    OR ce.currency_code LIKE 'GBP%'
                    OR ce.currency_code LIKE 'AUD%'
                    OR ce.currency_code LIKE 'CAD%'
                    OR ce.currency_code LIKE 'CHF%'
                    OR ce.currency_code LIKE 'HKD%'
                    OR ce.currency_code LIKE 'SGD%'
                  )
                """,
            (rs, rowNum) -> mapForeignExchangeRate(
                rs.getDate("base_date").toLocalDate(),
                rs.getString("currency_code"),
                rs.getString("currency_name"),
                rs.getBigDecimal("deal_bas_rate"),
                rs.getString("source"),
                rs.getTimestamp("fetched_at").toInstant(),
                rs.getDate("history_start_date") == null ? null : rs.getDate("history_start_date").toLocalDate(),
                rs.getDate("history_end_date") == null ? null : rs.getDate("history_end_date").toLocalDate()
            )
        );
    }

    private List<ForeignExchangeRate> findLatestDailyForeignExchangeRatesExcludingCurrent() {
        return jdbcTemplate.query(
            """
                SELECT exchange_rates.base_date, exchange_rates.currency_code, exchange_rates.currency_name,
                       exchange_rates.deal_bas_rate, exchange_rates.source, exchange_rates.fetched_at,
                       coverage.history_start_date, coverage.history_end_date
                FROM exchange_rates
                JOIN (
                    SELECT currency_code, MAX(base_date) AS latest_base_date
                    FROM exchange_rates
                    WHERE (
                        currency_code = 'USD'
                        OR currency_code LIKE 'JPY%'
                        OR currency_code LIKE 'EUR%'
                        OR currency_code LIKE 'CNY%'
                        OR currency_code LIKE 'CNH%'
                        OR currency_code LIKE 'GBP%'
                        OR currency_code LIKE 'AUD%'
                        OR currency_code LIKE 'CAD%'
                        OR currency_code LIKE 'CHF%'
                        OR currency_code LIKE 'HKD%'
                        OR currency_code LIKE 'SGD%'
                      )
                    GROUP BY currency_code
                ) latest_rates
                  ON latest_rates.currency_code = exchange_rates.currency_code
                 AND latest_rates.latest_base_date = exchange_rates.base_date
                JOIN (
                    SELECT currency_code, MIN(base_date) AS history_start_date, MAX(base_date) AS history_end_date
                    FROM exchange_rates
                    GROUP BY currency_code
                ) coverage
                  ON coverage.currency_code = exchange_rates.currency_code
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM current_exchange_rates current_rates
                    WHERE current_rates.currency_code = exchange_rates.currency_code
                )
                """,
            (rs, rowNum) -> {
                String rawCode = rs.getString("currency_code");
                return new ForeignExchangeRate(
                    rs.getDate("base_date").toLocalDate(),
                    rawCode,
                    foreignExchangeMapper.displayCurrencyCode(rawCode),
                    rs.getString("currency_name"),
                    rs.getBigDecimal("deal_bas_rate"),
                    foreignExchangeMapper.currencyUnitSize(rawCode),
                    rs.getString("source"),
                    rs.getTimestamp("fetched_at").toInstant(),
                    rs.getDate("history_start_date").toLocalDate(),
                    rs.getDate("history_end_date").toLocalDate()
                );
            }
        );
    }

    private ForeignExchangeRate findLatestForeignExchangeRate(String currencyCode) {
        ForeignExchangeRate current = findLatestCurrentForeignExchangeRate(currencyCode);
        if (current != null) {
            return current;
        }

        return jdbcTemplate.query(
            """
                SELECT er.base_date, er.currency_code, er.currency_name, er.deal_bas_rate, er.source, er.fetched_at,
                       coverage.history_start_date, coverage.history_end_date
                FROM exchange_rates er
                JOIN (
                    SELECT currency_code, MIN(base_date) AS history_start_date, MAX(base_date) AS history_end_date
                    FROM exchange_rates
                    WHERE currency_code = ?
                    GROUP BY currency_code
                ) coverage
                  ON coverage.currency_code = er.currency_code
                WHERE er.currency_code = ?
                ORDER BY er.base_date DESC
                LIMIT 1
                """,
            (rs, rowNum) -> mapForeignExchangeRate(
                rs.getDate("base_date").toLocalDate(),
                rs.getString("currency_code"),
                rs.getString("currency_name"),
                rs.getBigDecimal("deal_bas_rate"),
                rs.getString("source"),
                rs.getTimestamp("fetched_at").toInstant(),
                rs.getDate("history_start_date").toLocalDate(),
                rs.getDate("history_end_date").toLocalDate()
            ),
            currencyCode,
            currencyCode
        ).stream().findFirst().orElse(null);
    }

    private ForeignExchangeRate findLatestCurrentForeignExchangeRate(String currencyCode) {
        return jdbcTemplate.query(
            """
                SELECT ce.base_date, ce.currency_code, ce.currency_name, ce.deal_bas_rate, ce.source, ce.fetched_at,
                       coverage.history_start_date, coverage.history_end_date
                FROM current_exchange_rates ce
                LEFT JOIN (
                    SELECT currency_code, MIN(base_date) AS history_start_date, MAX(base_date) AS history_end_date
                    FROM exchange_rates
                    WHERE currency_code = ?
                    GROUP BY currency_code
                ) coverage
                  ON coverage.currency_code = ce.currency_code
                WHERE ce.currency_code = ?
                LIMIT 1
                """,
            (rs, rowNum) -> mapForeignExchangeRate(
                rs.getDate("base_date").toLocalDate(),
                rs.getString("currency_code"),
                rs.getString("currency_name"),
                rs.getBigDecimal("deal_bas_rate"),
                rs.getString("source"),
                rs.getTimestamp("fetched_at").toInstant(),
                rs.getDate("history_start_date") == null ? null : rs.getDate("history_start_date").toLocalDate(),
                rs.getDate("history_end_date") == null ? null : rs.getDate("history_end_date").toLocalDate()
            ),
            currencyCode,
            currencyCode
        ).stream().findFirst().orElse(null);
    }

    private ForeignExchangeRate findForeignExchangeRateAtOrBefore(String currencyCode, LocalDate date) {
        return jdbcTemplate.query(
            """
                SELECT er.base_date, er.currency_code, er.currency_name, er.deal_bas_rate, er.source, er.fetched_at,
                       coverage.history_start_date, coverage.history_end_date
                FROM exchange_rates er
                JOIN (
                    SELECT currency_code, MIN(base_date) AS history_start_date, MAX(base_date) AS history_end_date
                    FROM exchange_rates
                    WHERE currency_code = ?
                    GROUP BY currency_code
                ) coverage
                  ON coverage.currency_code = er.currency_code
                WHERE er.currency_code = ?
                  AND er.base_date <= ?
                ORDER BY er.base_date DESC
                LIMIT 1
                """,
            (rs, rowNum) -> mapForeignExchangeRate(
                rs.getDate("base_date").toLocalDate(),
                rs.getString("currency_code"),
                rs.getString("currency_name"),
                rs.getBigDecimal("deal_bas_rate"),
                rs.getString("source"),
                rs.getTimestamp("fetched_at").toInstant(),
                rs.getDate("history_start_date").toLocalDate(),
                rs.getDate("history_end_date").toLocalDate()
            ),
            currencyCode,
            currencyCode,
            date
        ).stream().findFirst().orElse(null);
    }

    private ForeignExchangeRate mapForeignExchangeRate(LocalDate baseDate, String rawCode, String currencyName, BigDecimal dealBasRate, String source, Instant fetchedAt, LocalDate historyStartDate, LocalDate historyEndDate) {
        return foreignExchangeMapper.toForeignExchangeRate(baseDate, rawCode, currencyName, dealBasRate, source, fetchedAt, historyStartDate, historyEndDate);
    }

    private ExchangeRateCalculatorMeta exchangeRateCalculatorMeta(List<ForeignExchangeRate> rates) {
        LocalDate latestAllowedDate = rates.stream()
            .map(ForeignExchangeRate::historyEndDate)
            .filter(Objects::nonNull)
            .max(LocalDate::compareTo)
            .orElse(LocalDate.now(SEOUL_ZONE));
        LocalDate earliestAllowedDate = rates.stream()
            .map(ForeignExchangeRate::historyStartDate)
            .filter(Objects::nonNull)
            .min(LocalDate::compareTo)
            .orElse(latestAllowedDate.minusYears(5));
        return new ExchangeRateCalculatorMeta(earliestAllowedDate, latestAllowedDate);
    }

    private BigDecimal rateGap(InterestRate latestUsRate, InterestRate latestKrRate) {
        if (latestUsRate == null || latestKrRate == null) {
            return null;
        }

        return latestUsRate.getRateValue().subtract(latestKrRate.getRateValue());
    }

    private DollarIndexStatus dollarIndexStatus(DollarIndex latestDollarIndex, String seriesId) {
        if (latestDollarIndex == null) {
            return new DollarIndexStatus(null, null, null);
        }
        return new DollarIndexStatus(
            latestDollarIndex.getBaseDate(),
            latestDollarIndex.getFetchedAt(),
            fredNextReleaseDate(seriesId)
        );
    }

    private LocalDate fredNextReleaseDate(String seriesId) {
        if (fredClient == null) {
            return null;
        }
        try {
            return fredClient.fetchNextReleaseDate(seriesId, LocalDate.now(SEOUL_ZONE)).orElse(null);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    public record DailyDashboardResponse(
        LocalDate baseDate,
        List<MetricSnapshot> metrics,
        List<TimeSeriesPoint> usdKrwSeries,
        List<IntradayTimeSeriesPoint> usdKrwIntradaySeries,
        List<IntradayCandlestickPoint> usdKrwIntradayCandles,
        List<TimeSeriesPoint> dxyIndexSeries,
        List<TimeSeriesPoint> dollarIndexSeries,
        DollarIndexStatus advancedDollarIndexStatus,
        DollarIndexStatus dollarIndexStatus,
        List<CurrencyStrengthRank> currencyStrengthRanks,
        List<ForeignExchangeRate> foreignExchangeRates,
        ExchangeRateCalculatorMeta exchangeRateCalculator,
        List<DomesticIndicator> domesticIndicators,
        List<DataSourceInfo> dataSources,
        String freshnessStatus,
        String staleReason,
        Instant expectedNextUpdateAt,
        Instant lastSuccessfulFetchedAt
    ) {
    }

    public record MetricSnapshot(
        String code,
        String label,
        BigDecimal value,
        String unit,
        BigDecimal changeRate
    ) {
    }

    public record TimeSeriesPoint(
        LocalDate baseDate,
        BigDecimal value
    ) {
    }

    public record DollarIndexStatus(
        LocalDate latestBaseDate,
        Instant fetchedAt,
        LocalDate nextReleaseDate
    ) {
    }

    public record IntradayTimeSeriesPoint(
        Instant observedAt,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal value,
        Instant fetchedAt
    ) {
    }

    public record IntradayCandlestickPoint(
        Instant observedAt,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close,
        int sourcePointCount,
        boolean complete,
        Instant fetchedAt
    ) {
    }

    public record DomesticIndicatorHistoryResponse(
        String code,
        String title,
        String unit,
        String range,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal averageValue,
        List<String> availableRanges,
        List<TimeSeriesPoint> points
    ) {
    }

    private record EffectiveExchangeRateRow(
        LocalDate baseDate,
        String areaCode,
        String areaName,
        BigDecimal value,
        Instant fetchedAt
    ) {
    }

    public record CurrencyStrengthRank(
        LocalDate baseDate,
        String areaCode,
        String areaName,
        BigDecimal neerValue,
        int neerRank,
        int totalCount,
        LocalDate reerBaseDate,
        BigDecimal reerValue,
        Integer previousNeerRank,
        BigDecimal previousNeerValue,
        BigDecimal neerValueChange,
        Instant fetchedAt
    ) {
    }

    public record ForeignExchangeRate(
        LocalDate baseDate,
        String currencyCode,
        String displayCode,
        String currencyName,
        BigDecimal dealBasRate,
        int unitSize,
        String source,
        Instant fetchedAt,
        LocalDate historyStartDate,
        LocalDate historyEndDate
    ) {
    }

    public record ExchangeRateCalculatorMeta(
        LocalDate earliestAllowedDate,
        LocalDate latestAllowedDate
    ) {
    }

    public record ExchangeRateSnapshotResponse(
        String currencyCode,
        LocalDate requestedDate,
        ForeignExchangeRate historicalRate,
        ForeignExchangeRate currentRate
    ) {
    }

    public record DomesticIndicator(
        String code,
        String title,
        String category,
        BigDecimal value,
        String unit,
        LocalDate baseDate,
        Instant observedAt,
        BigDecimal previousValue,
        LocalDate previousBaseDate,
        String source,
        String sourceUrl,
        Instant fetchedAt,
        String krwImpact,
        String note,
        String status,
        String detailUrl,
        String freshnessStatus,
        String staleReason,
        String freshnessReason,
        Instant expectedNextUpdateAt,
        Instant lastSuccessfulFetchedAt,
        List<IndicatorComponentFreshness> componentFreshnesses
    ) {
        public DomesticIndicator(
            String code,
            String title,
            String category,
            BigDecimal value,
            String unit,
            LocalDate baseDate,
            BigDecimal previousValue,
            LocalDate previousBaseDate,
            String source,
            Instant fetchedAt,
            String krwImpact,
            String note,
            String status,
            String detailUrl,
            String freshnessStatus,
            String staleReason,
            Instant expectedNextUpdateAt,
            Instant lastSuccessfulFetchedAt
        ) {
            this(
                code,
                title,
                category,
                value,
                unit,
                baseDate,
                null,
                previousValue,
                previousBaseDate,
                source,
                DashboardSourceMapper.resolveUrl(source, detailUrl),
                fetchedAt,
                krwImpact,
                note,
                status,
                detailUrl,
                freshnessStatus,
                staleReason,
                staleReason,
                expectedNextUpdateAt,
                lastSuccessfulFetchedAt,
                List.of()
            );
        }
    }

    public record IndicatorComponentFreshness(
        String code,
        String title,
        LocalDate baseDate,
        Instant observedAt,
        Instant fetchedAt,
        String source,
        String sourceUrl,
        String freshnessStatus,
        String freshnessReason
    ) {
    }

    public record DataSourceInfo(
        String code,
        String title,
        String api,
        String updatePolicy,
        String note
    ) {
    }
}
