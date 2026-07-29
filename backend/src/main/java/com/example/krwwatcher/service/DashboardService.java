package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
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

import com.example.krwwatcher.config.ExternalApiProperties;
import com.example.krwwatcher.domain.DollarIndex;
import com.example.krwwatcher.domain.ExchangeRate;
import com.example.krwwatcher.domain.ForeignReserve;
import com.example.krwwatcher.domain.InterestRate;
import com.example.krwwatcher.repository.DollarIndexRepository;
import com.example.krwwatcher.repository.ExchangeRateRepository;
import com.example.krwwatcher.repository.ForeignReserveRepository;
import com.example.krwwatcher.repository.InterestRateRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final List<String> FOREIGN_EXCHANGE_ORDER = List.of("USD", "JPY", "EUR", "CNY", "CNH", "GBP", "AUD", "CAD", "CHF", "HKD", "SGD");
    private static final String FRESH = "FRESH";
    private static final String STALE = "STALE";
    private static final String MISSING = "MISSING";
    private static final Duration MACRO_COLLECTION_STALE_AFTER = Duration.ofDays(2);

    private final ExternalApiProperties properties;
    private final ExchangeRateRepository exchangeRateRepository;
    private final DollarIndexRepository dollarIndexRepository;
    private final InterestRateRepository interestRateRepository;
    private final ForeignReserveRepository foreignReserveRepository;
    private final JdbcTemplate jdbcTemplate;

    public DashboardService(
        ExternalApiProperties properties,
        ExchangeRateRepository exchangeRateRepository,
        DollarIndexRepository dollarIndexRepository,
        InterestRateRepository interestRateRepository,
        ForeignReserveRepository foreignReserveRepository,
        JdbcTemplate jdbcTemplate
    ) {
        this.properties = properties;
        this.exchangeRateRepository = exchangeRateRepository;
        this.dollarIndexRepository = dollarIndexRepository;
        this.interestRateRepository = interestRateRepository;
        this.foreignReserveRepository = foreignReserveRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public DailyDashboardResponse daily() {
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
        List<TimeSeriesPoint> usdKrwSeries = mergeLatestIntradayPoint(usdKrwDailySeries, usdKrwIntradaySeries);
        List<CurrencyStrengthRank> currencyStrengthRanks = findCurrencyStrengthRanks();
        List<ForeignExchangeRate> foreignExchangeRates = findForeignExchangeRates();

        TimeSeriesPoint latestUsdKrw = usdKrwSeries.isEmpty() ? null : usdKrwSeries.get(usdKrwSeries.size() - 1);
        LocalDate baseDate = latestUsdKrw != null ? latestUsdKrw.baseDate() : LocalDate.now();
        List<DomesticIndicator> domesticIndicators = domesticIndicators(latestUsdKrw, latestUsdKrwDaily, usdKrwIntradaySeries, latestKrRate, latestUsRate, latestForeignReserve, currencyStrengthRanks);
        FreshnessInfo dashboardFreshness = aggregateFreshness(domesticIndicators);

        return new DailyDashboardResponse(
            baseDate,
            List.of(
                metric("USD/KRW", "원/달러 환율", latestUsdKrw == null ? null : latestUsdKrw.value(), "KRW"),
                metric("ADVANCED_DOLLAR_INDEX", "주요 7개 통화권 달러인덱스", latestAdvancedDollarIndex == null ? null : latestAdvancedDollarIndex.getValue(), "INDEX"),
                metric("BROAD_DOLLAR_INDEX", "26개 교역 상대 달러인덱스", latestDollarIndex == null ? null : latestDollarIndex.getValue(), "INDEX"),
                metric("US_POLICY_RATE", "미국 기준금리", latestUsRate == null ? null : latestUsRate.getRateValue(), "PERCENT"),
                metric("KR_POLICY_RATE", "한국 기준금리", latestKrRate == null ? null : latestKrRate.getRateValue(), "PERCENT"),
                metric("KR_US_RATE_GAP", "한미 기준금리차", rateGap(latestUsRate, latestKrRate), "PERCENT_POINT"),
                metric("FOREIGN_RESERVES", "대한민국 외환보유액", latestForeignReserve == null ? null : latestForeignReserve.getAmountUsdMillion(), "USD_MILLION")
            ),
            usdKrwSeries,
            usdKrwIntradaySeries,
            advancedDollarIndexSeries,
            dollarIndexSeries,
            dollarIndexStatus(latestAdvancedDollarIndex),
            dollarIndexStatus(latestDollarIndex),
            currencyStrengthRanks,
            foreignExchangeRates,
            exchangeRateCalculatorMeta(foreignExchangeRates),
            domesticIndicators,
            dataSourceInfos(),
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
        DomesticIndicatorMetadata metadata = domesticIndicatorMetadata(code);
        BigDecimal averageValue = average(points);

        return new DomesticIndicatorHistoryResponse(
            code,
            metadata.title(),
            metadata.unit(),
            historyRange.key(),
            startDate,
            endDate,
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
        ForeignReserve latestForeignReserve,
        List<CurrencyStrengthRank> currencyStrengthRanks
    ) {
        ExchangeRate previousUsdKrwDaily = latestUsdKrwDaily == null ? null : exchangeRateRepository
            .findTopByCurrencyCodeAndBaseDateBeforeOrderByBaseDateDesc("USD", latestUsdKrwDaily.getBaseDate())
            .orElse(null);
        InterestRate previousKrRate = latestKrRate == null ? null : interestRateRepository
            .findTopByCountryCodeAndRateTypeAndBaseDateBeforeOrderByBaseDateDesc("KR", "POLICY_RATE", latestKrRate.getBaseDate())
            .orElse(null);
        InterestRate previousUsRate = latestUsRate == null ? null : interestRateRepository
            .findTopByCountryCodeAndRateTypeAndBaseDateBeforeOrderByBaseDateDesc("US", "POLICY_RATE", latestUsRate.getBaseDate())
            .orElse(null);
        ForeignReserve previousForeignReserve = latestForeignReserve == null ? null : foreignReserveRepository
            .findTopByBaseDateBeforeOrderByBaseDateDesc(latestForeignReserve.getBaseDate())
            .orElse(null);
        IntradayTimeSeriesPoint latestIntraday = usdKrwIntradaySeries.isEmpty() ? null : usdKrwIntradaySeries.get(usdKrwIntradaySeries.size() - 1);
        FreshnessInfo usdKrwFreshness = usdKrwFreshness(latestIntraday, latestUsdKrwDaily, latestUsdKrw == null ? null : latestUsdKrw.baseDate(), latestUsdKrw == null ? null : latestUsdKrw.value(), Instant.now());

        BigDecimal rateGap = rateGap(latestUsRate, latestKrRate);
        BigDecimal previousRateGap = rateGap(previousUsRate, previousKrRate);
        LocalDate rateGapBaseDate = latestUsRate == null || latestKrRate == null
            ? null
            : latestUsRate.getBaseDate().isAfter(latestKrRate.getBaseDate()) ? latestKrRate.getBaseDate() : latestUsRate.getBaseDate();
        LocalDate previousRateGapBaseDate = previousUsRate == null || previousKrRate == null
            ? null
            : previousUsRate.getBaseDate().isAfter(previousKrRate.getBaseDate()) ? previousKrRate.getBaseDate() : previousUsRate.getBaseDate();

        List<DomesticIndicator> indicators = new ArrayList<>();
        indicators.add(new DomesticIndicator(
            "USD_KRW",
            "원/달러 환율",
            "환율 현재 압력",
            latestUsdKrw == null ? null : latestUsdKrw.value(),
            "KRW",
            latestIntraday == null ? latestUsdKrw == null ? null : latestUsdKrw.baseDate() : latestIntraday.observedAt().toLocalDate(),
            previousUsdKrwDaily == null ? null : previousUsdKrwDaily.getDealBasRate(),
            previousUsdKrwDaily == null ? null : previousUsdKrwDaily.getBaseDate(),
            latestIntraday == null ? latestUsdKrwDaily == null ? "Koreaexim/FRED" : latestUsdKrwDaily.getSource() : "Twelve Data:USD/KRW 1min",
            latestIntraday == null ? latestUsdKrwDaily == null ? null : latestUsdKrwDaily.getFetchedAt() : latestIntraday.fetchedAt(),
            "환율 상승은 같은 1달러를 사기 위해 더 많은 원화가 필요하다는 뜻이어서 원화 약세 압력으로 봅니다.",
            "Twelve Data 1분봉과 일별 저장 환율을 함께 사용합니다.",
            statusLabel(usdKrwFreshness),
            null,
            usdKrwFreshness.freshnessStatus(),
            usdKrwFreshness.staleReason(),
            usdKrwFreshness.expectedNextUpdateAt(),
            usdKrwFreshness.lastSuccessfulFetchedAt()
        ));
        FreshnessInfo krPolicyFreshness = freshness("KR_POLICY_RATE", latestKrRate == null ? null : latestKrRate.getBaseDate(), latestKrRate == null ? null : latestKrRate.getRateValue(), latestKrRate == null ? null : latestKrRate.getFetchedAt(), Instant.now());
        indicators.add(new DomesticIndicator(
            "KR_POLICY_RATE",
            "한국 기준금리",
            "통화 정책",
            latestKrRate == null ? null : latestKrRate.getRateValue(),
            "PERCENT",
            latestKrRate == null ? null : latestKrRate.getBaseDate(),
            previousKrRate == null ? null : previousKrRate.getRateValue(),
            previousKrRate == null ? null : previousKrRate.getBaseDate(),
            latestKrRate == null ? "ECOS" : latestKrRate.getSource(),
            latestKrRate == null ? null : latestKrRate.getFetchedAt(),
            "한국 금리가 상대적으로 높아지면 원화 보유 유인이 커질 수 있지만, 성장 둔화 우려와 함께 봐야 합니다.",
            "한국은행 ECOS에서 발표된 기준금리 저장값입니다.",
            statusLabel(krPolicyFreshness),
            null,
            krPolicyFreshness.freshnessStatus(),
            krPolicyFreshness.staleReason(),
            krPolicyFreshness.expectedNextUpdateAt(),
            krPolicyFreshness.lastSuccessfulFetchedAt()
        ));
        FreshnessInfo usPolicyFreshness = freshness("US_POLICY_RATE", latestUsRate == null ? null : latestUsRate.getBaseDate(), latestUsRate == null ? null : latestUsRate.getRateValue(), latestUsRate == null ? null : latestUsRate.getFetchedAt(), Instant.now());
        indicators.add(new DomesticIndicator(
            "US_POLICY_RATE",
            "미국 기준금리",
            "대외 금리 압력",
            latestUsRate == null ? null : latestUsRate.getRateValue(),
            "PERCENT",
            latestUsRate == null ? null : latestUsRate.getBaseDate(),
            previousUsRate == null ? null : previousUsRate.getRateValue(),
            previousUsRate == null ? null : previousUsRate.getBaseDate(),
            latestUsRate == null ? "FRED" : latestUsRate.getSource(),
            latestUsRate == null ? null : latestUsRate.getFetchedAt(),
            "미국 금리가 높거나 인하 기대가 약하면 달러 선호가 강해져 원화에는 부담이 될 수 있습니다.",
            "FRED의 미국 정책금리 계열을 저장합니다.",
            statusLabel(usPolicyFreshness),
            null,
            usPolicyFreshness.freshnessStatus(),
            usPolicyFreshness.staleReason(),
            usPolicyFreshness.expectedNextUpdateAt(),
            usPolicyFreshness.lastSuccessfulFetchedAt()
        ));
        Instant rateGapFetchedAt = latestUsRate == null ? null : latestUsRate.getFetchedAt();
        FreshnessInfo rateGapFreshness = freshness("KR_US_RATE_GAP", rateGapBaseDate, rateGap, rateGapFetchedAt, Instant.now());
        indicators.add(new DomesticIndicator(
            "KR_US_RATE_GAP",
            "한미 기준금리차",
            "대외 금리 압력",
            rateGap,
            "PERCENT_POINT",
            rateGapBaseDate,
            previousRateGap,
            previousRateGapBaseDate,
            "FRED/ECOS",
            rateGapFetchedAt,
            "값이 플러스면 미국 기준금리가 한국보다 높다는 뜻입니다. 격차 확대는 원화 약세 요인으로 해석될 수 있습니다.",
            "미국 기준금리에서 한국 기준금리를 뺀 값입니다.",
            statusLabel(rateGapFreshness),
            null,
            rateGapFreshness.freshnessStatus(),
            rateGapFreshness.staleReason(),
            rateGapFreshness.expectedNextUpdateAt(),
            rateGapFreshness.lastSuccessfulFetchedAt()
        ));
        FreshnessInfo foreignReserveFreshness = freshness("FOREIGN_RESERVES", latestForeignReserve == null ? null : latestForeignReserve.getBaseDate(), latestForeignReserve == null ? null : latestForeignReserve.getAmountUsdMillion(), latestForeignReserve == null ? null : latestForeignReserve.getFetchedAt(), Instant.now());
        indicators.add(new DomesticIndicator(
            "FOREIGN_RESERVES",
            "외환보유액",
            "외환 방어력",
            latestForeignReserve == null ? null : latestForeignReserve.getAmountUsdMillion(),
            "USD_MILLION",
            latestForeignReserve == null ? null : latestForeignReserve.getBaseDate(),
            previousForeignReserve == null ? null : previousForeignReserve.getAmountUsdMillion(),
            previousForeignReserve == null ? null : previousForeignReserve.getBaseDate(),
            latestForeignReserve == null ? "ECOS" : latestForeignReserve.getSource(),
            latestForeignReserve == null ? null : latestForeignReserve.getFetchedAt(),
            "외환보유액은 급격한 외환시장 변동에 대응할 수 있는 완충 여력으로 봅니다.",
            "한국은행 ECOS 외환보유액 월별 발표값입니다.",
            statusLabel(foreignReserveFreshness),
            null,
            foreignReserveFreshness.freshnessStatus(),
            foreignReserveFreshness.staleReason(),
            foreignReserveFreshness.expectedNextUpdateAt(),
            foreignReserveFreshness.lastSuccessfulFetchedAt()
        ));
        indicators.addAll(domesticPolicyIndicators());
        return indicators;
    }

    private List<DomesticIndicator> domesticPolicyIndicators() {
        List<String> codes = List.of(
            "M2",
            "CURRENT_ACCOUNT",
            "GOODS_ACCOUNT",
            "CPI",
            "PPI",
            "EXPORT_AMOUNT",
            "IMPORT_AMOUNT",
            "TRADE_BALANCE",
            "RESERVES_TO_SHORT_TERM_DEBT",
            "FISCAL_BALANCE",
            "GOVERNMENT_DEBT",
            "FOREIGN_STOCK_FLOW",
            "FOREIGN_BOND_FLOW",
            "TERMS_OF_TRADE",
            "US_10Y_TREASURY",
            "VIX",
            "WTI_OIL",
            "KOREA_CDS"
        );
        return codes.stream()
            .map(this::domesticPolicyIndicator)
            .filter(Objects::nonNull)
            .toList();
    }

    private DomesticIndicator domesticPolicyIndicator(String code) {
        DomesticPolicyIndicatorRow latest = findLatestDomesticPolicyIndicator(code);
        if (latest == null) {
            return pendingDomesticPolicyIndicator(code);
        }

        DomesticPolicyIndicatorRow previous = findPreviousDomesticPolicyIndicator(code, latest.baseDate());
        FreshnessInfo freshness = freshness(latest.code(), latest.baseDate(), latest.value(), latest.fetchedAt(), Instant.now());
        return new DomesticIndicator(
            latest.code(),
            latest.title(),
            latest.category(),
            latest.value(),
            latest.unit(),
            latest.baseDate(),
            previous != null ? previous.value() : null,
            previous != null ? previous.baseDate() : null,
            sourceLabel(latest.source()),
            latest.fetchedAt(),
            domesticPolicyImpact(latest.code()),
            domesticPolicyNote(latest.code()),
            statusLabel(freshness),
            detailUrl(latest.source()),
            freshness.freshnessStatus(),
            freshness.staleReason(),
            freshness.expectedNextUpdateAt(),
            freshness.lastSuccessfulFetchedAt()
        );
    }

    private DomesticIndicator pendingDomesticPolicyIndicator(String code) {
        return switch (code) {
            case "FISCAL_BALANCE" -> pendingIndicator(
                "FISCAL_BALANCE",
                "재정수지",
                "재정 정책",
                "KRW_TRILLION",
                "OPENFISCAL:BudgetBalance",
                "재정수지 악화는 정부 재정 건전성 우려와 국채 수급 부담을 통해 원화 신뢰도에 부담이 될 수 있습니다.",
                "열린재정 Open API 키가 설정되면 월별 관리재정수지 값을 저장합니다."
            );
            case "GOVERNMENT_DEBT" -> pendingIndicator(
                "GOVERNMENT_DEBT",
                "중앙정부 국가채무",
                "재정 정책",
                "KRW_TRILLION",
                "OPENFISCAL:GovernmentDebtMonth",
                "국가채무 증가는 중장기 재정 여력과 국가 신용위험 평가에 영향을 줄 수 있어 환율 리스크와 함께 봅니다.",
                "열린재정 Open API 키가 설정되면 월별 중앙정부 국가채무 총액을 저장합니다."
            );
            default -> null;
        };
    }

    private DomesticIndicator pendingIndicator(
        String code,
        String title,
        String category,
        String unit,
        String source,
        String krwImpact,
        String note
    ) {
        return new DomesticIndicator(
            code,
            title,
            category,
            null,
            unit,
            null,
            null,
            null,
            source,
            null,
            krwImpact,
            note,
            "연동 필요",
            null,
            MISSING,
            "저장된 최신 수집값이 없습니다.",
            null,
            null
        );
    }

    private DomesticPolicyIndicatorRow findLatestDomesticPolicyIndicator(String code) {
        return jdbcTemplate.query(
            """
                SELECT indicator_code, title, category, base_date, value, unit, source, fetched_at
                FROM domestic_policy_indicators
                WHERE indicator_code = ?
                ORDER BY base_date DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new DomesticPolicyIndicatorRow(
                rs.getString("indicator_code"),
                rs.getString("title"),
                rs.getString("category"),
                rs.getDate("base_date").toLocalDate(),
                rs.getBigDecimal("value"),
                rs.getString("unit"),
                rs.getString("source"),
                rs.getTimestamp("fetched_at").toInstant()
            ),
            code
        ).stream().findFirst().orElse(null);
    }

    private DomesticPolicyIndicatorRow findPreviousDomesticPolicyIndicator(String code, LocalDate baseDate) {
        return jdbcTemplate.query(
            """
                SELECT indicator_code, title, category, base_date, value, unit, source, fetched_at
                FROM domestic_policy_indicators
                WHERE indicator_code = ?
                  AND base_date < ?
                ORDER BY base_date DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new DomesticPolicyIndicatorRow(
                rs.getString("indicator_code"),
                rs.getString("title"),
                rs.getString("category"),
                rs.getDate("base_date").toLocalDate(),
                rs.getBigDecimal("value"),
                rs.getString("unit"),
                rs.getString("source"),
                rs.getTimestamp("fetched_at").toInstant()
            ),
            code,
            baseDate
        ).stream().findFirst().orElse(null);
    }

    private String domesticPolicyImpact(String code) {
        return switch (code) {
            case "M2" -> "통화량 증가가 빠르면 원화 공급 확대와 인플레이션 기대를 통해 원화 약세 압력이 커질 수 있습니다.";
            case "CURRENT_ACCOUNT" -> "경상수지 흑자는 달러 유입 기반을 강화해 원화 안정 요인으로 해석됩니다.";
            case "GOODS_ACCOUNT" -> "상품수지 흑자는 무역을 통한 달러 유입을 늘려 원화에 우호적입니다.";
            case "CPI" -> "소비자물가 상승은 기준금리 인상 압력을 키울 수 있지만, 실질 구매력 악화와 함께 봐야 합니다.";
            case "PPI" -> "생산자물가 상승은 수입물가와 기업 비용 부담을 통해 물가와 환율 압력으로 이어질 수 있습니다.";
            case "EXPORT_AMOUNT" -> "수출 증가는 달러 공급을 늘려 원화 안정에 도움이 될 수 있습니다.";
            case "IMPORT_AMOUNT" -> "수입 증가는 달러 수요를 늘려 원화 약세 압력으로 작용할 수 있습니다.";
            case "TRADE_BALANCE" -> "무역수지 흑자는 달러 순유입, 적자는 달러 순유출 압력으로 봅니다.";
            case "RESERVES_TO_SHORT_TERM_DEBT" -> "단기외채 대비 외환보유액 비율이 높을수록 단기 대외지급 압력에 대응할 완충 여력이 크다고 봅니다.";
            case "SHORT_TERM_EXTERNAL_DEBT" -> "단기대외채무 증가는 가까운 시점의 외화 상환 부담을 키우는 요인으로 봅니다.";
            case "FISCAL_BALANCE" -> "재정수지 악화는 정부 재정 건전성 우려와 국채 수급 부담을 통해 원화 신뢰도에 부담이 될 수 있습니다.";
            case "GOVERNMENT_DEBT" -> "중앙정부 국가채무 증가는 재정 여력과 국가 신용위험 평가에 영향을 줄 수 있어 중장기 환율 리스크와 함께 봅니다.";
            case "FOREIGN_STOCK_FLOW" -> "외국인 주식 순매수는 원화 자산 수요와 환전 흐름을 통해 원화에 영향을 줄 수 있습니다.";
            case "FOREIGN_BOND_FLOW" -> "외국인 채권 보유잔액 증가는 중장기 원화채 수요를 보여주지만, 환헤지 비용과 금리차를 함께 봐야 합니다.";
            case "TERMS_OF_TRADE" -> "교역조건 악화는 같은 수출량으로 확보하는 구매력이 낮아지는 신호라 원화 펀더멘털에 부담이 될 수 있습니다.";
            case "US_10Y_TREASURY" -> "미국 장기금리 상승은 달러 자산 매력을 높여 원화에는 부담이 될 수 있습니다.";
            case "VIX" -> "VIX 상승은 위험회피 심리 확대로 이어져 신흥국·원화 자산에는 부담이 될 수 있습니다.";
            case "WTI_OIL" -> "유가 상승은 에너지 수입 부담을 키워 무역수지와 원화 수급에 부정적일 수 있습니다.";
            case "KOREA_CDS" -> "무료 공식 한국 CDS API가 없어 FRED 미국 하이일드 신용스프레드를 대외 신용위험 프록시로 사용합니다.";
            default -> "환율에 영향을 줄 수 있는 국내 정책·거시경제 지표입니다.";
        };
    }

    private String domesticPolicyNote(String code) {
        return switch (code) {
            case "M2" -> "ECOS 161Y005, M2 평잔 계절조정계열입니다.";
            case "CURRENT_ACCOUNT" -> "ECOS 301Y017, 경상수지 계절조정 월별 값입니다.";
            case "GOODS_ACCOUNT" -> "ECOS 301Y017, 상품수지 계절조정 월별 값입니다.";
            case "CPI" -> "ECOS 901Y009, 소비자물가지수 총지수입니다.";
            case "PPI" -> "ECOS 404Y014, 생산자물가지수 총지수입니다.";
            case "EXPORT_AMOUNT" -> "ECOS 901Y118, 수출금액입니다.";
            case "IMPORT_AMOUNT" -> "ECOS 901Y118, 수입금액입니다.";
            case "TRADE_BALANCE" -> "ECOS 901Y118 수출금액에서 수입금액을 뺀 계산값입니다.";
            case "RESERVES_TO_SHORT_TERM_DEBT" -> "ECOS 732Y001 외환보유액을 311Y004 단기대외채무로 나눠 계산한 분기 비율입니다.";
            case "SHORT_TERM_EXTERNAL_DEBT" -> "ECOS 311Y004, 대외채무 중 단기 항목 분기값입니다.";
            case "FISCAL_BALANCE" -> "열린재정 BudgetBalance, 월별 관리재정수지 조원 단위 저장값입니다.";
            case "GOVERNMENT_DEBT" -> "열린재정 GovernmentDebtMonth, 월별 중앙정부 국가채무 총액 조원 단위 저장값입니다.";
            case "FOREIGN_STOCK_FLOW" -> "ECOS 901Y055, 외국인 순매수 거래대금 월별 값이며 백만원을 억원으로 환산했습니다.";
            case "FOREIGN_BOND_FLOW" -> "ECOS 282Y006, 채권발행-보유관계표의 발행총계 중 국외 보유잔액 분기값이며 십억원을 조원으로 환산했습니다.";
            case "TERMS_OF_TRADE" -> "ECOS 403Y005, 순상품교역조건지수 월별 값입니다.";
            case "US_10Y_TREASURY" -> "FRED DGS10, 미국 10년 만기 국채 수익률입니다.";
            case "VIX" -> "FRED VIXCLS, CBOE VIX 종가 계열입니다.";
            case "WTI_OIL" -> "FRED DCOILWTICO, WTI 현물 유가 계열입니다.";
            case "KOREA_CDS" -> "FRED BAMLH0A0HYM2, ICE BofA 미국 하이일드 옵션조정스프레드입니다. 한국 CDS가 아니라 신용위험 프록시입니다.";
            default -> "ECOS 저장값 기준입니다.";
        };
    }

    private List<TimeSeriesPoint> mergeLatestIntradayPoint(List<TimeSeriesPoint> dailySeries, List<IntradayTimeSeriesPoint> intradaySeries) {
        if (intradaySeries.isEmpty()) {
            return dailySeries;
        }

        IntradayTimeSeriesPoint latestIntraday = intradaySeries.get(intradaySeries.size() - 1);
        LocalDate intradayDate = latestIntraday.observedAt().toLocalDate();
        TimeSeriesPoint intradayPoint = new TimeSeriesPoint(intradayDate, latestIntraday.value());
        if (dailySeries.isEmpty()) {
            return List.of(intradayPoint);
        }

        TimeSeriesPoint latestDaily = dailySeries.get(dailySeries.size() - 1);
        List<TimeSeriesPoint> mergedSeries = new ArrayList<>(dailySeries);
        if (intradayDate.isAfter(latestDaily.baseDate())) {
            mergedSeries.add(intradayPoint);
        } else if (intradayDate.isEqual(latestDaily.baseDate())) {
            mergedSeries.set(mergedSeries.size() - 1, intradayPoint);
        }

        return mergedSeries;
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
                SELECT observed_at, close_rate, fetched_at
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                  AND observed_at BETWEEN ? AND ?
                ORDER BY observed_at ASC
                """,
            (rs, rowNum) -> new IntradayTimeSeriesPoint(
                rs.getTimestamp("observed_at").toLocalDateTime(),
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
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toLocalDateTime(),
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

    private String statusLabel(FreshnessInfo freshness) {
        if (MISSING.equals(freshness.freshnessStatus())) {
            return "데이터 없음";
        }
        if (STALE.equals(freshness.freshnessStatus())) {
            return "업데이트 지연";
        }
        return "정상 수집";
    }

    private FreshnessInfo usdKrwFreshness(IntradayTimeSeriesPoint latestIntraday, ExchangeRate latestDaily, LocalDate baseDate, BigDecimal value, Instant now) {
        if (value == null) {
            return missingFreshness();
        }

        LocalDateTime seoulNow = LocalDateTime.ofInstant(now, SEOUL_ZONE);
        if (latestIntraday != null && UsdKrwIntradaySession.activeSessionStartDate(seoulNow) != null) {
            Instant lastObservedAt = latestIntraday.observedAt().atZone(SEOUL_ZONE).toInstant();
            Instant expectedNextUpdateAt = lastObservedAt.plus(Duration.ofMinutes(10));
            return now.isAfter(expectedNextUpdateAt)
                ? staleFreshness("USD/KRW 1분봉이 장중 허용 지연 10분을 넘었습니다.", expectedNextUpdateAt, latestIntraday.fetchedAt())
                : freshFreshness(expectedNextUpdateAt, latestIntraday.fetchedAt());
        }

        Instant fetchedAt = latestDaily == null ? null : latestDaily.getFetchedAt();
        return freshnessByBusinessDays("USD/KRW 일별 환율", baseDate, value, fetchedAt, now, 1);
    }

    private FreshnessInfo freshness(String code, LocalDate baseDate, BigDecimal value, Instant fetchedAt, Instant now) {
        if (value == null) {
            return missingFreshness();
        }

        return switch (code) {
            case "US_10Y_TREASURY", "VIX", "WTI_OIL", "KOREA_CDS" -> freshnessByBusinessDays(code, baseDate, value, fetchedAt, now, 2);
            case "US_POLICY_RATE" -> freshnessByBusinessDays(code, baseDate, value, fetchedAt, now, 2);
            case "RESERVES_TO_SHORT_TERM_DEBT" -> freshnessByMonths(code, baseDate, value, fetchedAt, now, 4);
            default -> freshnessByMonths(code, baseDate, value, fetchedAt, now, 2);
        };
    }

    private FreshnessInfo freshnessByBusinessDays(String label, LocalDate baseDate, BigDecimal value, Instant fetchedAt, Instant now, int allowedBusinessDays) {
        if (value == null || baseDate == null) {
            return missingFreshness();
        }
        if (isRecentlyFetched(fetchedAt, now)) {
            return freshFreshness(nextCollectionCheckAt(fetchedAt), fetchedAt);
        }

        LocalDate expectedDate = addBusinessDays(baseDate, allowedBusinessDays);
        Instant expectedNextUpdateAt = expectedDate.atTime(18, 0).atZone(SEOUL_ZONE).toInstant();
        return now.isAfter(expectedNextUpdateAt)
            ? staleFreshness(label + " 최신 발표 기준일이 허용 지연을 넘었습니다.", expectedNextUpdateAt, fetchedAt)
            : freshFreshness(expectedNextUpdateAt, fetchedAt);
    }

    private FreshnessInfo freshnessByMonths(String label, LocalDate baseDate, BigDecimal value, Instant fetchedAt, Instant now, int allowedMonths) {
        if (value == null || baseDate == null) {
            return missingFreshness();
        }
        if (isRecentlyFetched(fetchedAt, now)) {
            return freshFreshness(nextCollectionCheckAt(fetchedAt), fetchedAt);
        }

        Instant expectedNextUpdateAt = baseDate.plusMonths(allowedMonths).atTime(18, 0).atZone(SEOUL_ZONE).toInstant();
        return now.isAfter(expectedNextUpdateAt)
            ? staleFreshness(label + " 발표 주기 기준 허용 지연을 넘었습니다.", expectedNextUpdateAt, fetchedAt)
            : freshFreshness(expectedNextUpdateAt, fetchedAt);
    }

    private LocalDate addBusinessDays(LocalDate date, int days) {
        LocalDate cursor = date;
        int added = 0;
        while (added < days) {
            cursor = cursor.plusDays(1);
            if (isWeekday(cursor)) {
                added++;
            }
        }
        return cursor;
    }

    private boolean isRecentlyFetched(Instant fetchedAt, Instant now) {
        return fetchedAt != null && !now.isAfter(fetchedAt.plus(MACRO_COLLECTION_STALE_AFTER));
    }

    private Instant nextCollectionCheckAt(Instant fetchedAt) {
        return fetchedAt == null ? null : fetchedAt.plus(MACRO_COLLECTION_STALE_AFTER);
    }

    private FreshnessInfo aggregateFreshness(List<DomesticIndicator> indicators) {
        List<DomesticIndicator> staleIndicators = indicators.stream()
            .filter(indicator -> STALE.equals(indicator.freshnessStatus()))
            .toList();
        if (!staleIndicators.isEmpty()) {
            Instant oldestExpectedUpdate = staleIndicators.stream()
                .map(DomesticIndicator::expectedNextUpdateAt)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);
            Instant latestSuccessfulFetch = indicators.stream()
                .map(DomesticIndicator::lastSuccessfulFetchedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
            return new FreshnessInfo(
                STALE,
                staleIndicators.get(0).title() + " 등 " + staleIndicators.size() + "개 지표 업데이트가 지연되었습니다.",
                oldestExpectedUpdate,
                latestSuccessfulFetch
            );
        }

        boolean hasFresh = indicators.stream().anyMatch(indicator -> FRESH.equals(indicator.freshnessStatus()));
        Instant nextUpdate = indicators.stream()
            .map(DomesticIndicator::expectedNextUpdateAt)
            .filter(Objects::nonNull)
            .min(Comparator.naturalOrder())
            .orElse(null);
        Instant latestSuccessfulFetch = indicators.stream()
            .map(DomesticIndicator::lastSuccessfulFetchedAt)
            .filter(Objects::nonNull)
            .max(Comparator.naturalOrder())
            .orElse(null);
        return hasFresh ? new FreshnessInfo(FRESH, null, nextUpdate, latestSuccessfulFetch) : missingFreshness();
    }

    private FreshnessInfo missingFreshness() {
        return new FreshnessInfo(MISSING, "저장된 최신 수집값이 없습니다.", null, null);
    }

    private FreshnessInfo freshFreshness(Instant expectedNextUpdateAt, Instant fetchedAt) {
        return new FreshnessInfo(FRESH, null, expectedNextUpdateAt, fetchedAt);
    }

    private FreshnessInfo staleFreshness(String reason, Instant expectedNextUpdateAt, Instant fetchedAt) {
        return new FreshnessInfo(STALE, reason, expectedNextUpdateAt, fetchedAt);
    }

    private String sourceLabel(String source) {
        if (source == null) {
            return null;
        }
        return source.split("\\|", 2)[0];
    }

    private String detailUrl(String source) {
        if (source == null || !source.contains("|")) {
            return null;
        }
        return source.split("\\|", 2)[1];
    }

    private List<TimeSeriesPoint> findDomesticIndicatorHistoryPoints(String code, LocalDate startDate, LocalDate endDate) {
        return switch (code) {
            case "USD_KRW" -> jdbcTemplate.query(
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
            ).stream().filter(point -> isWeekday(point.baseDate())).toList();
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
            case "M2", "CURRENT_ACCOUNT", "GOODS_ACCOUNT", "CPI", "PPI", "EXPORT_AMOUNT", "IMPORT_AMOUNT",
                "TRADE_BALANCE", "RESERVES_TO_SHORT_TERM_DEBT", "SHORT_TERM_EXTERNAL_DEBT",
                "FISCAL_BALANCE", "GOVERNMENT_DEBT", "FOREIGN_STOCK_FLOW",
                "FOREIGN_BOND_FLOW", "TERMS_OF_TRADE", "US_10Y_TREASURY", "VIX",
                "WTI_OIL", "KOREA_CDS" -> jdbcTemplate.query(
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
        return switch (code) {
            case "USD_KRW" -> new DomesticIndicatorMetadata("원/달러 환율", "KRW");
            case "KR_POLICY_RATE" -> new DomesticIndicatorMetadata("한국 기준금리", "PERCENT");
            case "US_POLICY_RATE" -> new DomesticIndicatorMetadata("미국 기준금리", "PERCENT");
            case "KR_US_RATE_GAP" -> new DomesticIndicatorMetadata("한미 기준금리차", "PERCENT_POINT");
            case "FOREIGN_RESERVES" -> new DomesticIndicatorMetadata("외환보유액", "USD_MILLION");
            case "KR_NEER_RANK" -> new DomesticIndicatorMetadata("원화 명목실효환율 저평가 순위", "RANK");
            default -> {
                DomesticPolicyIndicatorRow latest = findLatestDomesticPolicyIndicator(code);
                if (latest == null) {
                    yield pendingDomesticIndicatorMetadata(code);
                }
                yield new DomesticIndicatorMetadata(latest.title(), latest.unit());
            }
        };
    }

    private DomesticIndicatorMetadata pendingDomesticIndicatorMetadata(String code) {
        return switch (code) {
            case "FISCAL_BALANCE" -> new DomesticIndicatorMetadata("재정수지", "KRW_TRILLION");
            case "GOVERNMENT_DEBT" -> new DomesticIndicatorMetadata("중앙정부 국가채무", "KRW_TRILLION");
            default -> throw new IllegalArgumentException("Unsupported domestic indicator code: " + code);
        };
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
            case "M2", "CURRENT_ACCOUNT", "GOODS_ACCOUNT", "CPI", "PPI", "EXPORT_AMOUNT", "IMPORT_AMOUNT",
                "TRADE_BALANCE", "RESERVES_TO_SHORT_TERM_DEBT", "SHORT_TERM_EXTERNAL_DEBT",
                "FISCAL_BALANCE", "GOVERNMENT_DEBT", "FOREIGN_STOCK_FLOW",
                "FOREIGN_BOND_FLOW", "TERMS_OF_TRADE", "US_10Y_TREASURY", "VIX",
                "WTI_OIL", "KOREA_CDS" -> queryEarliestDate(
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

    private BigDecimal average(List<TimeSeriesPoint> points) {
        if (points.isEmpty()) {
            return null;
        }

        BigDecimal sum = points.stream()
            .map(TimeSeriesPoint::value)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(points.size()), 6, RoundingMode.HALF_UP);
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
                SELECT base_date, area_code, area_name, value
                FROM effective_exchange_rates
                WHERE index_type = 'NEER'
                  AND basket_type = 'BROAD'
                  AND base_date = ?
                """,
            (rs, rowNum) -> new EffectiveExchangeRateRow(
                rs.getDate("base_date").toLocalDate(),
                rs.getString("area_code"),
                rs.getString("area_name"),
                rs.getBigDecimal("value")
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
                previousValue == null ? null : row.value().subtract(previousValue)
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
                SELECT base_date, area_code, area_name, value
                FROM effective_exchange_rates
                WHERE index_type = 'NEER'
                  AND basket_type = 'BROAD'
                  AND base_date = ?
                """,
            (rs, rowNum) -> new EffectiveExchangeRateRow(
                rs.getDate("base_date").toLocalDate(),
                rs.getString("area_code"),
                rs.getString("area_name"),
                rs.getBigDecimal("value")
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
            .sorted(Comparator.comparingInt(row -> foreignExchangeOrder(row.displayCode())))
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
                String displayCode = displayCurrencyCode(rawCode);
                return new ForeignExchangeRate(
                    rs.getDate("base_date").toLocalDate(),
                    rawCode,
                    displayCode,
                    rs.getString("currency_name"),
                    rs.getBigDecimal("deal_bas_rate"),
                    currencyUnitSize(rawCode),
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
        return new ForeignExchangeRate(
            baseDate,
            rawCode,
            displayCurrencyCode(rawCode),
            currencyName,
            dealBasRate,
            currencyUnitSize(rawCode),
            source,
            fetchedAt,
            historyStartDate,
            historyEndDate
        );
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

    private int foreignExchangeOrder(String currencyCode) {
        int index = FOREIGN_EXCHANGE_ORDER.indexOf(currencyCode);
        return index < 0 ? FOREIGN_EXCHANGE_ORDER.size() : index;
    }

    private String displayCurrencyCode(String rawCode) {
        int parenthesisIndex = rawCode.indexOf('(');
        return parenthesisIndex < 0 ? rawCode : rawCode.substring(0, parenthesisIndex);
    }

    private int currencyUnitSize(String rawCode) {
        int start = rawCode.indexOf('(');
        int end = rawCode.indexOf(')');
        if (start < 0 || end <= start + 1) {
            return 1;
        }

        try {
            return Integer.parseInt(rawCode.substring(start + 1, end));
        } catch (NumberFormatException exception) {
            return 1;
        }
    }

    private List<DataSourceInfo> dataSourceInfos() {
        return List.of(
            new DataSourceInfo(
                "USD_KRW",
                "USD/KRW 추이",
                "Twelve Data time_series USD/KRW 1min, 한국수출입은행 현재환율 API, FRED DEXKOUS fallback",
                "1일 차트는 주중 24시간 intraday 세션을 별도로 수집하고, 전체 수집은 평일 09:10/15:10에 실행합니다.",
                "Twelve Data는 API 제한 보호를 위해 1일 1분봉에만 사용하고, 긴 기간은 Koreaexim/FRED 일별 저장값을 사용합니다."
            ),
            new DataSourceInfo(
                "ADVANCED_DOLLAR_INDEX",
                "주요 7개 통화권 달러인덱스",
                "FRED DTWEXAFEGS",
                "전체 시장 데이터 수집 시 FRED daily observations 저장",
                "유로지역, 캐나다, 일본, 영국, 스위스, 호주, 스웨덴 통화권 대비 달러 강도를 보는 FRED 공식 무역가중 지표입니다. 공식 ICE DXY와는 다른 지표입니다."
            ),
            new DataSourceInfo(
                "BROAD_DOLLAR_INDEX",
                "26개 교역 상대 달러인덱스",
                "FRED DTWEXBGS",
                "전체 시장 데이터 수집 시 FRED daily observations 저장",
                "한국, 중국, 멕시코, 캐나다, 유로지역 등 26개 교역 상대 통화 대비 달러 강도를 보는 FRED 공식 무역가중 지표입니다."
            ),
            new DataSourceInfo(
                "CURRENCY_STRENGTH",
                "실효환율 통화가치 랭킹",
                "BIS WS_EER effective exchange rates bulk CSV",
                "평일 09:10/15:10 KST 전체 시장 데이터 수집 시 broad NEER/REER 최신 발표값 저장",
                "NEER/REER는 2020=100 지수이며 낮을수록 교역상대국 대비 통화가치가 낮습니다. 랭킹은 낮은 NEER부터 매긴 저평가 순위입니다."
            ),
            new DataSourceInfo(
                "FOREIGN_EXCHANGE",
                "주요 통화 원화 환율",
                "Twelve Data exchange_rate, 한국수출입은행 현재환율 API AP01, FRED 주요 통화 환율 시리즈 fallback",
                "15분마다 최대 4개 통화만 확인하며, 각 통화는 약 1시간 주기로 순차 갱신합니다.",
                "Twelve Data 현재환율을 우선 사용하고 실패하면 한국수출입은행/FRED 일별 값으로 보강합니다. JPY는 100엔당 기준을 함께 표시합니다."
            ),
            new DataSourceInfo(
                "MACRO",
                "금리·외환 여건",
                "FRED FEDFUNDS/DGS10/VIXCLS/DCOILWTICO, ECOS 722Y001/732Y001",
                "전체 시장 데이터 수집 시 발표된 최신값 저장",
                "한국 기준금리와 외환보유액은 한국은행 ECOS, 미국 기준금리·장기금리·VIX·WTI 유가는 FRED를 사용합니다."
            ),
            new DataSourceInfo(
                "FISCAL_POLICY",
                "재정 정책",
                "열린재정 Open API BudgetBalance/GovernmentDebtMonth",
                "전체 시장 데이터 수집 시 최근 3년 월별 재정수지와 중앙정부 국가채무 저장",
                "재정수지는 관리재정수지, 국가채무는 중앙정부 국가채무 총액을 조원 단위로 저장합니다."
            ),
            new DataSourceInfo(
                "CAPITAL_FLOW",
                "자본 흐름·신용위험",
                "ECOS 901Y055/282Y006, FRED BAMLH0A0HYM2",
                "전체 시장 데이터 수집 시 발표된 최신 월별·분기별·일별 값을 저장",
                "외국인 주식은 순매수 거래대금, 채권은 국외 보유잔액입니다. 한국 CDS는 무료 공식 API가 없어 글로벌 신용스프레드 프록시로 표시합니다."
            )
        );
    }

    private BigDecimal rateGap(InterestRate latestUsRate, InterestRate latestKrRate) {
        if (latestUsRate == null || latestKrRate == null) {
            return null;
        }

        return latestUsRate.getRateValue().subtract(latestKrRate.getRateValue());
    }

    private DollarIndexStatus dollarIndexStatus(DollarIndex latestDollarIndex) {
        if (latestDollarIndex == null) {
            return new DollarIndexStatus(null, null);
        }
        return new DollarIndexStatus(latestDollarIndex.getBaseDate(), latestDollarIndex.getFetchedAt());
    }

    public record DailyDashboardResponse(
        LocalDate baseDate,
        List<MetricSnapshot> metrics,
        List<TimeSeriesPoint> usdKrwSeries,
        List<IntradayTimeSeriesPoint> usdKrwIntradaySeries,
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
        Instant fetchedAt
    ) {
    }

    public record IntradayTimeSeriesPoint(
        LocalDateTime observedAt,
        BigDecimal value,
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

    private enum HistoryRange {
        ONE_YEAR("1Y", 1),
        THREE_YEARS("3Y", 3),
        FIVE_YEARS("5Y", 5);

        private final String key;
        private final int years;

        HistoryRange(String key, int years) {
            this.key = key;
            this.years = years;
        }

        private String key() {
            return key;
        }

        private int years() {
            return years;
        }

        private static HistoryRange from(String value) {
            for (HistoryRange range : values()) {
                if (range.key.equalsIgnoreCase(value)) {
                    return range;
                }
            }
            return THREE_YEARS;
        }
    }

    private record DomesticIndicatorMetadata(String title, String unit) {
    }

    private record EffectiveExchangeRateRow(
        LocalDate baseDate,
        String areaCode,
        String areaName,
        BigDecimal value
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
        BigDecimal neerValueChange
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
    }

    private record FreshnessInfo(
        String freshnessStatus,
        String staleReason,
        Instant expectedNextUpdateAt,
        Instant lastSuccessfulFetchedAt
    ) {
    }

    private record DomesticPolicyIndicatorRow(
        String code,
        String title,
        String category,
        LocalDate baseDate,
        BigDecimal value,
        String unit,
        String source,
        Instant fetchedAt
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
