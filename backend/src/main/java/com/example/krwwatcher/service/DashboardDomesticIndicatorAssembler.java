package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import com.example.krwwatcher.domain.ExchangeRate;
import com.example.krwwatcher.domain.ForeignReserve;
import com.example.krwwatcher.domain.InterestRate;
import com.example.krwwatcher.repository.ExchangeRateRepository;
import com.example.krwwatcher.repository.ForeignReserveRepository;
import com.example.krwwatcher.repository.InterestRateRepository;
import org.springframework.jdbc.core.JdbcTemplate;

// Assembles dashboard domestic indicator response records from latest market and macro data.
class DashboardDomesticIndicatorAssembler {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final List<String> DOMESTIC_POLICY_CODES = List.of(
        "US_TREASURY_1MO",
        "US_TREASURY_3MO",
        "US_TREASURY_6MO",
        "US_TREASURY_1Y",
        "US_TREASURY_2Y",
        "US_TREASURY_3Y",
        "US_TREASURY_5Y",
        "US_TREASURY_7Y",
        "US_10Y_TREASURY",
        "US_TREASURY_20Y",
        "US_TREASURY_30Y",
        "SOFR",
        "SOFR_30D_AVG",
        "SOFR_90D_AVG",
        "SOFR_180D_AVG",
        "SOFR_INDEX",
        "KOFR",
        "CD_91D",
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
        "VIX",
        "WTI_OIL",
        "GLOBAL_CREDIT_SPREAD_PROXY"
    );

    private final ExchangeRateRepository exchangeRateRepository;
    private final InterestRateRepository interestRateRepository;
    private final ForeignReserveRepository foreignReserveRepository;
    private final JdbcTemplate jdbcTemplate;
    private final DashboardDomesticIndicatorMetadata indicatorMetadata;
    private final DashboardMetricCalculator metricCalculator;
    private final DashboardSourceMapper sourceMapper;
    private final DashboardFreshnessPolicy freshnessPolicy;

    DashboardDomesticIndicatorAssembler(
        ExchangeRateRepository exchangeRateRepository,
        InterestRateRepository interestRateRepository,
        ForeignReserveRepository foreignReserveRepository,
        JdbcTemplate jdbcTemplate,
        DashboardDomesticIndicatorMetadata indicatorMetadata,
        DashboardMetricCalculator metricCalculator,
        DashboardSourceMapper sourceMapper,
        DashboardFreshnessPolicy freshnessPolicy
    ) {
        this.exchangeRateRepository = exchangeRateRepository;
        this.interestRateRepository = interestRateRepository;
        this.foreignReserveRepository = foreignReserveRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.indicatorMetadata = indicatorMetadata;
        this.metricCalculator = metricCalculator;
        this.sourceMapper = sourceMapper;
        this.freshnessPolicy = freshnessPolicy;
    }

    List<DashboardService.DomesticIndicator> domesticIndicators(
        DashboardService.TimeSeriesPoint latestUsdKrw,
        ExchangeRate latestUsdKrwDaily,
        List<DashboardService.IntradayTimeSeriesPoint> usdKrwIntradaySeries,
        InterestRate latestKrRate,
        InterestRate latestUsRate,
        ForeignReserve latestForeignReserve
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
        DashboardService.IntradayTimeSeriesPoint latestIntraday = usdKrwIntradaySeries.isEmpty() ? null : usdKrwIntradaySeries.get(usdKrwIntradaySeries.size() - 1);
        DashboardFreshnessInfo usdKrwFreshness = freshnessPolicy.usdKrwFreshness(latestIntraday, latestUsdKrwDaily, latestUsdKrw == null ? null : latestUsdKrw.baseDate(), latestUsdKrw == null ? null : latestUsdKrw.value(), Instant.now());

        BigDecimal rateGap = metricCalculator.rateGap(
            latestUsRate == null ? null : latestUsRate.getRateValue(),
            latestKrRate == null ? null : latestKrRate.getRateValue()
        );
        BigDecimal previousRateGap = metricCalculator.rateGap(
            previousUsRate == null ? null : previousUsRate.getRateValue(),
            previousKrRate == null ? null : previousKrRate.getRateValue()
        );
        LocalDate rateGapBaseDate = latestUsRate == null || latestKrRate == null
            ? null
            : latestUsRate.getBaseDate().isAfter(latestKrRate.getBaseDate()) ? latestKrRate.getBaseDate() : latestUsRate.getBaseDate();
        LocalDate previousRateGapBaseDate = previousUsRate == null || previousKrRate == null
            ? null
            : previousUsRate.getBaseDate().isAfter(previousKrRate.getBaseDate()) ? previousKrRate.getBaseDate() : previousUsRate.getBaseDate();

        List<DashboardService.DomesticIndicator> indicators = new ArrayList<>();
        indicators.add(new DashboardService.DomesticIndicator(
            "USD_KRW",
            "원/달러 환율",
            "환율 현재 압력",
            latestUsdKrw == null ? null : latestUsdKrw.value(),
            "KRW",
            latestIntraday == null ? latestUsdKrw == null ? null : latestUsdKrw.baseDate() : toSeoulDateTime(latestIntraday.observedAt()).toLocalDate(),
            latestIntraday == null ? null : latestIntraday.observedAt(),
            previousUsdKrwDaily == null ? null : previousUsdKrwDaily.getDealBasRate(),
            previousUsdKrwDaily == null ? null : previousUsdKrwDaily.getBaseDate(),
            latestIntraday == null ? latestUsdKrwDaily == null ? "Koreaexim/FRED" : latestUsdKrwDaily.getSource() : "Twelve Data:USD/KRW 1min",
            sourceMapper.url(latestIntraday == null ? latestUsdKrwDaily == null ? "Koreaexim/FRED" : latestUsdKrwDaily.getSource() : "Twelve Data:USD/KRW 1min", null),
            latestIntraday == null ? latestUsdKrwDaily == null ? null : latestUsdKrwDaily.getFetchedAt() : latestIntraday.fetchedAt(),
            "환율 상승은 같은 1달러를 사기 위해 더 많은 원화가 필요하다는 뜻이어서 원화 약세 압력으로 봅니다.",
            "Twelve Data 1분봉과 일별 저장 환율을 함께 사용합니다.",
            freshnessPolicy.statusLabel(usdKrwFreshness),
            null,
            usdKrwFreshness.freshnessStatus(),
            usdKrwFreshness.staleReason(),
            usdKrwFreshness.staleReason(),
            usdKrwFreshness.expectedNextUpdateAt(),
            usdKrwFreshness.lastSuccessfulFetchedAt(),
            List.of()
        ));
        DashboardFreshnessInfo krPolicyFreshness = freshnessPolicy.freshness("KR_POLICY_RATE", latestKrRate == null ? null : latestKrRate.getBaseDate(), latestKrRate == null ? null : latestKrRate.getRateValue(), latestKrRate == null ? null : latestKrRate.getFetchedAt(), Instant.now());
        indicators.add(new DashboardService.DomesticIndicator(
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
            freshnessPolicy.statusLabel(krPolicyFreshness),
            null,
            krPolicyFreshness.freshnessStatus(),
            krPolicyFreshness.staleReason(),
            krPolicyFreshness.expectedNextUpdateAt(),
            krPolicyFreshness.lastSuccessfulFetchedAt()
        ));
        DashboardFreshnessInfo usPolicyFreshness = freshnessPolicy.freshness("US_POLICY_RATE", latestUsRate == null ? null : latestUsRate.getBaseDate(), latestUsRate == null ? null : latestUsRate.getRateValue(), latestUsRate == null ? null : latestUsRate.getFetchedAt(), Instant.now());
        indicators.add(new DashboardService.DomesticIndicator(
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
            freshnessPolicy.statusLabel(usPolicyFreshness),
            null,
            usPolicyFreshness.freshnessStatus(),
            usPolicyFreshness.staleReason(),
            usPolicyFreshness.expectedNextUpdateAt(),
            usPolicyFreshness.lastSuccessfulFetchedAt()
        ));
        Instant rateGapFetchedAt = metricCalculator.oldestInstant(
            latestKrRate == null ? null : latestKrRate.getFetchedAt(),
            latestUsRate == null ? null : latestUsRate.getFetchedAt()
        );
        List<DashboardService.IndicatorComponentFreshness> rateGapComponents = List.of(
            indicatorComponent("KR_POLICY_RATE", "한국 기준금리", latestKrRate == null ? null : latestKrRate.getBaseDate(), null, latestKrRate == null ? null : latestKrRate.getFetchedAt(), latestKrRate == null ? "ECOS" : latestKrRate.getSource(), krPolicyFreshness),
            indicatorComponent("US_POLICY_RATE", "미국 기준금리", latestUsRate == null ? null : latestUsRate.getBaseDate(), null, latestUsRate == null ? null : latestUsRate.getFetchedAt(), latestUsRate == null ? "FRED" : latestUsRate.getSource(), usPolicyFreshness)
        );
        DashboardFreshnessInfo rateGapFreshness = freshnessPolicy.aggregateCalculationFreshness(rateGapComponents);
        indicators.add(new DashboardService.DomesticIndicator(
            "KR_US_RATE_GAP",
            "한미 기준금리차",
            "대외 금리 압력",
            rateGap,
            "PERCENT_POINT",
            rateGapBaseDate,
            null,
            previousRateGap,
            previousRateGapBaseDate,
            "FRED/ECOS",
            sourceMapper.url("FRED/ECOS", null),
            rateGapFetchedAt,
            "값이 플러스면 미국 기준금리가 한국보다 높다는 뜻입니다. 격차 확대는 원화 약세 요인으로 해석될 수 있습니다.",
            "미국 기준금리에서 한국 기준금리를 뺀 값입니다.",
            freshnessPolicy.statusLabel(rateGapFreshness),
            null,
            rateGapFreshness.freshnessStatus(),
            rateGapFreshness.staleReason(),
            rateGapFreshness.staleReason(),
            rateGapFreshness.expectedNextUpdateAt(),
            rateGapFreshness.lastSuccessfulFetchedAt(),
            rateGapComponents
        ));
        DashboardFreshnessInfo foreignReserveFreshness = freshnessPolicy.freshness("FOREIGN_RESERVES", latestForeignReserve == null ? null : latestForeignReserve.getBaseDate(), latestForeignReserve == null ? null : latestForeignReserve.getAmountUsdMillion(), latestForeignReserve == null ? null : latestForeignReserve.getFetchedAt(), Instant.now());
        indicators.add(new DashboardService.DomesticIndicator(
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
            freshnessPolicy.statusLabel(foreignReserveFreshness),
            null,
            foreignReserveFreshness.freshnessStatus(),
            foreignReserveFreshness.staleReason(),
            foreignReserveFreshness.expectedNextUpdateAt(),
            foreignReserveFreshness.lastSuccessfulFetchedAt()
        ));
        indicators.addAll(domesticPolicyIndicators());
        return indicators;
    }

    List<DashboardService.DomesticIndicator> domesticPolicyIndicators() {
        return DOMESTIC_POLICY_CODES.stream()
            .map(this::domesticPolicyIndicator)
            .filter(Objects::nonNull)
            .toList();
    }

    DomesticIndicatorMetadata domesticIndicatorMetadata(String code) {
        DomesticIndicatorMetadata baseMetadata = indicatorMetadata.baseMetadata(code);
        if (baseMetadata != null) {
            return baseMetadata;
        }

        DomesticPolicyIndicatorRow latest = findLatestDomesticPolicyIndicator(code);
        if (latest == null) {
            return indicatorMetadata.pendingMetadata(code);
        }
        return new DomesticIndicatorMetadata(latest.title(), latest.unit());
    }

    DashboardService.DomesticIndicator domesticPolicyIndicator(String code) {
        DomesticPolicyIndicatorRow latest = findLatestDomesticPolicyIndicator(code);
        if (latest == null) {
            return pendingDomesticPolicyIndicator(code);
        }

        DomesticPolicyIndicatorRow previous = findPreviousDomesticPolicyIndicator(code, latest.baseDate());
        DashboardFreshnessInfo freshness = freshnessPolicy.freshness(latest.code(), latest.baseDate(), latest.value(), latest.fetchedAt(), Instant.now());
        return new DashboardService.DomesticIndicator(
            latest.code(),
            latest.title(),
            latest.category(),
            latest.value(),
            latest.unit(),
            latest.baseDate(),
            previous != null ? previous.value() : null,
            previous != null ? previous.baseDate() : null,
            sourceMapper.label(latest.source()),
            latest.fetchedAt(),
            indicatorMetadata.impact(latest.code()),
            indicatorMetadata.note(latest.code()),
            freshnessPolicy.statusLabel(freshness),
            sourceMapper.detailUrl(latest.source()),
            freshness.freshnessStatus(),
            freshness.staleReason(),
            freshness.expectedNextUpdateAt(),
            freshness.lastSuccessfulFetchedAt()
        );
    }

    DashboardService.DomesticIndicator pendingDomesticPolicyIndicator(String code) {
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

    private DashboardService.DomesticIndicator pendingIndicator(
        String code,
        String title,
        String category,
        String unit,
        String source,
        String krwImpact,
        String note
    ) {
        return new DashboardService.DomesticIndicator(
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
            DashboardFreshnessPolicy.MISSING,
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

    private DashboardService.IndicatorComponentFreshness indicatorComponent(
        String code,
        String title,
        LocalDate baseDate,
        Instant observedAt,
        Instant fetchedAt,
        String source,
        DashboardFreshnessInfo freshness
    ) {
        String sourceLabel = sourceMapper.label(source);
        return new DashboardService.IndicatorComponentFreshness(
            code,
            title,
            baseDate,
            observedAt,
            fetchedAt,
            sourceLabel,
            sourceMapper.url(sourceLabel, sourceMapper.detailUrl(source)),
            freshness.freshnessStatus(),
            freshness.staleReason()
        );
    }

    private LocalDateTime toSeoulDateTime(Instant instant) {
        return LocalDateTime.ofInstant(instant, SEOUL_ZONE);
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
}
