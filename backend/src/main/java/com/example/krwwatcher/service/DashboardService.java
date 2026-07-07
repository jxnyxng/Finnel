package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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

@Service
public class DashboardService {

    private static final LocalTime INTRADAY_SESSION_START = LocalTime.of(9, 0);
    private static final LocalTime INTRADAY_SESSION_END = LocalTime.of(2, 0);
    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");

    private final ExternalApiProperties properties;
    private final ExchangeRateRepository exchangeRateRepository;
    private final DollarIndexRepository dollarIndexRepository;
    private final InterestRateRepository interestRateRepository;
    private final ForeignReserveRepository foreignReserveRepository;
    private final MarketDataSyncService marketDataSyncService;
    private final JdbcTemplate jdbcTemplate;

    public DashboardService(
        ExternalApiProperties properties,
        ExchangeRateRepository exchangeRateRepository,
        DollarIndexRepository dollarIndexRepository,
        InterestRateRepository interestRateRepository,
        ForeignReserveRepository foreignReserveRepository,
        MarketDataSyncService marketDataSyncService,
        JdbcTemplate jdbcTemplate
    ) {
        this.properties = properties;
        this.exchangeRateRepository = exchangeRateRepository;
        this.dollarIndexRepository = dollarIndexRepository;
        this.interestRateRepository = interestRateRepository;
        this.foreignReserveRepository = foreignReserveRepository;
        this.marketDataSyncService = marketDataSyncService;
        this.jdbcTemplate = jdbcTemplate;
    }

    public DailyDashboardResponse daily() {
        marketDataSyncService.ensureIntradayForDisplay();

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

        TimeSeriesPoint latestUsdKrw = usdKrwSeries.isEmpty() ? null : usdKrwSeries.get(usdKrwSeries.size() - 1);
        LocalDate baseDate = latestUsdKrw != null ? latestUsdKrw.baseDate() : LocalDate.now();

        return new DailyDashboardResponse(
            baseDate,
            List.of(
                metric("USD/KRW", "원/달러 환율", latestUsdKrw == null ? null : latestUsdKrw.value(), "KRW"),
                metric("ADVANCED_DOLLAR_INDEX", "선진국 달러 지수", latestAdvancedDollarIndex == null ? null : latestAdvancedDollarIndex.getValue(), "INDEX"),
                metric("BROAD_DOLLAR_INDEX", "광의 달러 지수", latestDollarIndex == null ? null : latestDollarIndex.getValue(), "INDEX"),
                metric("US_POLICY_RATE", "미국 기준금리", latestUsRate == null ? null : latestUsRate.getRateValue(), "PERCENT"),
                metric("KR_POLICY_RATE", "한국 기준금리", latestKrRate == null ? null : latestKrRate.getRateValue(), "PERCENT"),
                metric("KR_US_RATE_GAP", "한미 기준금리차", rateGap(latestUsRate, latestKrRate), "PERCENT_POINT"),
                metric("FOREIGN_RESERVES", "대한민국 외환보유액", latestForeignReserve == null ? null : latestForeignReserve.getAmountUsdMillion(), "USD_MILLION")
            ),
            usdKrwSeries,
            usdKrwIntradaySeries,
            advancedDollarIndexSeries,
            dollarIndexSeries,
            currencyStrengthRanks,
            domesticIndicators(latestUsdKrw, latestUsdKrwDaily, usdKrwIntradaySeries, latestKrRate, latestUsRate, latestForeignReserve, currencyStrengthRanks),
            dataSourceInfos()
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
        CurrencyStrengthRank krRank = currencyStrengthRanks.stream()
            .filter(rank -> "KR".equals(rank.areaCode()))
            .findFirst()
            .orElse(null);
        IntradayTimeSeriesPoint latestIntraday = usdKrwIntradaySeries.isEmpty() ? null : usdKrwIntradaySeries.get(usdKrwIntradaySeries.size() - 1);

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
            latestIntraday == null ? latestUsdKrwDaily == null ? "Koreaexim/FRED" : latestUsdKrwDaily.getSource() : "Twelve Data:USD/KRW 5min",
            latestIntraday == null && latestUsdKrwDaily != null ? latestUsdKrwDaily.getFetchedAt() : null,
            "환율 상승은 같은 1달러를 사기 위해 더 많은 원화가 필요하다는 뜻이어서 원화 약세 압력으로 봅니다.",
            "Twelve Data 5분봉과 일별 저장 환율을 함께 사용합니다.",
            statusLabel(latestUsdKrw == null ? null : latestUsdKrw.value())
        ));
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
            statusLabel(latestKrRate == null ? null : latestKrRate.getRateValue())
        ));
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
            statusLabel(latestUsRate == null ? null : latestUsRate.getRateValue())
        ));
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
            latestUsRate == null ? null : latestUsRate.getFetchedAt(),
            "값이 플러스면 미국 기준금리가 한국보다 높다는 뜻입니다. 격차 확대는 원화 약세 요인으로 해석될 수 있습니다.",
            "미국 기준금리에서 한국 기준금리를 뺀 값입니다.",
            statusLabel(rateGap)
        ));
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
            statusLabel(latestForeignReserve == null ? null : latestForeignReserve.getAmountUsdMillion())
        ));
        indicators.add(new DomesticIndicator(
            "KR_NEER_RANK",
            "원화 명목실효환율 저평가 순위",
            "원화 상대 가치",
            krRank == null ? null : BigDecimal.valueOf(krRank.neerRank()),
            "RANK",
            krRank == null ? null : krRank.baseDate(),
            null,
            null,
            "BIS WS_EER",
            null,
            "이 순위는 NEER 값이 낮은 통화부터 매긴 저평가 순위입니다. 1위에 가까울수록 주요 교역상대국 대비 통화가치가 낮은 편입니다.",
            krRank == null ? "BIS 명목실효환율 최신값이 아직 저장되지 않았습니다." : "BIS broad NEER 기준 " + krRank.totalCount() + "개국 중 원화 저평가 순위입니다.",
            statusLabel(krRank == null ? null : krRank.neerValue())
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
            "FISCAL_BALANCE",
            "GOVERNMENT_DEBT",
            "FOREIGN_STOCK_FLOW",
            "FOREIGN_BOND_FLOW",
            "TERMS_OF_TRADE",
            "MPC_MINUTES",
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
        return new DomesticIndicator(
            latest.code(),
            latest.title(),
            latest.category(),
            latest.value(),
            latest.unit(),
            latest.baseDate(),
            previous == null ? null : previous.value(),
            previous == null ? null : previous.baseDate(),
            latest.source(),
            latest.fetchedAt(),
            domesticPolicyImpact(latest.code()),
            domesticPolicyNote(latest.code()),
            statusLabel(latest.value())
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
            "연동 필요"
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
            case "FISCAL_BALANCE" -> "재정수지 악화는 정부 재정 건전성 우려와 국채 수급 부담을 통해 원화 신뢰도에 부담이 될 수 있습니다.";
            case "GOVERNMENT_DEBT" -> "중앙정부 국가채무 증가는 재정 여력과 국가 신용위험 평가에 영향을 줄 수 있어 중장기 환율 리스크와 함께 봅니다.";
            case "FOREIGN_STOCK_FLOW" -> "외국인 주식 순매수는 원화 자산 수요와 환전 흐름을 통해 원화에 영향을 줄 수 있습니다.";
            case "FOREIGN_BOND_FLOW" -> "외국인 채권 보유잔액 증가는 중장기 원화채 수요를 보여주지만, 환헤지 비용과 금리차를 함께 봐야 합니다.";
            case "TERMS_OF_TRADE" -> "교역조건 악화는 같은 수출량으로 확보하는 구매력이 낮아지는 신호라 원화 펀더멘털에 부담이 될 수 있습니다.";
            case "MPC_MINUTES" -> "금통위 의사록과 의결문은 향후 금리 방향에 대한 기대를 바꿔 원화 심리에 영향을 줄 수 있습니다.";
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
            case "FISCAL_BALANCE" -> "열린재정 BudgetBalance, 월별 관리재정수지 조원 단위 저장값입니다.";
            case "GOVERNMENT_DEBT" -> "열린재정 GovernmentDebtMonth, 월별 중앙정부 국가채무 총액 조원 단위 저장값입니다.";
            case "FOREIGN_STOCK_FLOW" -> "ECOS 901Y055, 외국인 순매수 거래대금 월별 값이며 백만원을 억원으로 환산했습니다.";
            case "FOREIGN_BOND_FLOW" -> "ECOS 282Y006, 채권발행-보유관계표의 발행총계 중 국외 보유잔액 분기값이며 십억원을 조원으로 환산했습니다.";
            case "TERMS_OF_TRADE" -> "ECOS 403Y005, 순상품교역조건지수 월별 값입니다.";
            case "MPC_MINUTES" -> "한국은행 금융통화위원회 의사록 공식 목록 페이지 접근 상태를 저장합니다. 문서 본문 감성 분석은 별도 단계입니다.";
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

    private boolean isWeekday(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        return dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY;
    }

    private List<IntradayTimeSeriesPoint> findLatestIntradaySeries() {
        LocalDate currentDisplaySessionStartDate = currentDisplaySessionStartDate();
        LocalDateTime latestObservedAt = findLatestIntradayObservedAt(null);
        while (latestObservedAt != null) {
            LocalDate sessionStartDate = latestObservedAt.toLocalTime().isBefore(INTRADAY_SESSION_START)
                ? latestObservedAt.toLocalDate().minusDays(1)
                : latestObservedAt.toLocalDate();
            if (isWeekday(sessionStartDate)) {
                LocalDateTime sessionStart = LocalDateTime.of(sessionStartDate, INTRADAY_SESSION_START);
                LocalDateTime sessionEnd = LocalDateTime.of(sessionStartDate.plusDays(1), INTRADAY_SESSION_END);
                List<IntradayTimeSeriesPoint> sessionSeries = jdbcTemplate.query(
                    """
                        SELECT observed_at, close_rate
                        FROM intraday_exchange_rates
                        WHERE currency_pair = ?
                          AND observed_at BETWEEN ? AND ?
                        ORDER BY observed_at ASC
                        """,
                    (rs, rowNum) -> new IntradayTimeSeriesPoint(
                        rs.getTimestamp("observed_at").toLocalDateTime(),
                        rs.getBigDecimal("close_rate")
                    ),
                    properties.twelveData().usdKrwSymbol(),
                    sessionStart,
                    sessionEnd
                );
                if (isDisplayableIntradaySession(sessionStartDate, currentDisplaySessionStartDate, sessionSeries)) {
                    return sessionSeries;
                }
            }

            latestObservedAt = findLatestIntradayObservedAt(LocalDateTime.of(sessionStartDate, INTRADAY_SESSION_START));
        }
        return List.of();
    }

    private boolean isDisplayableIntradaySession(
        LocalDate sessionStartDate,
        LocalDate currentDisplaySessionStartDate,
        List<IntradayTimeSeriesPoint> sessionSeries
    ) {
        if (sessionSeries.isEmpty()) {
            return false;
        }

        long distinctCloseRates = sessionSeries.stream()
            .map(IntradayTimeSeriesPoint::value)
            .distinct()
            .limit(2)
            .count();
        if (distinctCloseRates > 1) {
            return true;
        }

        return sessionStartDate.isEqual(currentDisplaySessionStartDate) && sessionSeries.size() < 3;
    }

    private LocalDate currentDisplaySessionStartDate() {
        LocalDateTime now = LocalDateTime.now(SEOUL_ZONE);
        LocalDate sessionStartDate;
        if (now.toLocalTime().isBefore(INTRADAY_SESSION_END)) {
            sessionStartDate = now.toLocalDate().minusDays(1);
        } else if (now.toLocalTime().isBefore(INTRADAY_SESSION_START)) {
            sessionStartDate = previousWeekday(now.toLocalDate());
        } else {
            sessionStartDate = now.toLocalDate();
        }

        return isWeekday(sessionStartDate) ? sessionStartDate : previousWeekday(sessionStartDate.plusDays(1));
    }

    private LocalDate previousWeekday(LocalDate date) {
        LocalDate candidate = date.minusDays(1);
        while (!isWeekday(candidate)) {
            candidate = candidate.minusDays(1);
        }
        return candidate;
    }

    private LocalDateTime findLatestIntradayObservedAt(LocalDateTime beforeExclusive) {
        if (beforeExclusive == null) {
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

        return jdbcTemplate.query(
            """
                SELECT MAX(observed_at)
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                  AND observed_at < ?
                """,
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toLocalDateTime(),
            properties.twelveData().usdKrwSymbol(),
            beforeExclusive
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private MetricSnapshot metric(String code, String label, BigDecimal value, String unit) {
        return new MetricSnapshot(code, label, value, unit, null);
    }

    private String statusLabel(BigDecimal value) {
        return value == null ? "데이터 없음" : "정상 수집";
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
        List<CurrencyStrengthRank> ranks = new ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            EffectiveExchangeRateRow row = rows.get(index);
            ranks.add(new CurrencyStrengthRank(
                row.baseDate(),
                row.areaCode(),
                row.areaName(),
                row.value(),
                index + 1,
                totalCount,
                latestReerDate,
                latestReerByArea.get(row.areaCode())
            ));
        }
        return ranks;
    }

    private List<DataSourceInfo> dataSourceInfos() {
        return List.of(
            new DataSourceInfo(
                "USD_KRW",
                "USD/KRW 추이",
                "Twelve Data time_series USD/KRW 5min, 한국수출입은행 현재환율 API, FRED DEXKOUS fallback",
                "1일 세션은 별도 intraday 수집, 전체 수집은 평일 09:10/15:10",
                "Twelve Data는 API 제한 보호를 위해 1일 5분봉에만 사용하고, 긴 기간은 Koreaexim/FRED 일별 저장값을 사용합니다."
            ),
            new DataSourceInfo(
                "ADVANCED_DOLLAR_INDEX",
                "선진국 달러 지수",
                "FRED DTWEXAFEGS",
                "전체 시장 데이터 수집 시 FRED daily observations 저장",
                "미국의 주요 선진국 교역 상대 통화 대비 달러 강도를 보는 FRED 공식 무역가중 지표입니다. 공식 ICE DXY와는 다른 지표입니다."
            ),
            new DataSourceInfo(
                "BROAD_DOLLAR_INDEX",
                "광의 달러 지수",
                "FRED DTWEXBGS",
                "전체 시장 데이터 수집 시 FRED daily observations 저장",
                "미국의 넓은 교역 상대 통화 대비 달러 강도를 보는 무역가중 지표입니다."
            ),
            new DataSourceInfo(
                "CURRENCY_STRENGTH",
                "실효환율 통화가치 랭킹",
                "BIS WS_EER effective exchange rates bulk CSV",
                "평일 09:10/15:10 KST 전체 시장 데이터 수집 시 broad NEER/REER 최신 발표값 저장",
                "NEER/REER는 2020=100 지수이며 낮을수록 교역상대국 대비 통화가치가 낮습니다. 랭킹은 낮은 NEER부터 매긴 저평가 순위입니다."
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
                "ECOS 901Y055/282Y006, FRED BAMLH0A0HYM2, 한국은행 금통위 의사록 목록",
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

    public record DailyDashboardResponse(
        LocalDate baseDate,
        List<MetricSnapshot> metrics,
        List<TimeSeriesPoint> usdKrwSeries,
        List<IntradayTimeSeriesPoint> usdKrwIntradaySeries,
        List<TimeSeriesPoint> dxyIndexSeries,
        List<TimeSeriesPoint> dollarIndexSeries,
        List<CurrencyStrengthRank> currencyStrengthRanks,
        List<DomesticIndicator> domesticIndicators,
        List<DataSourceInfo> dataSources
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

    public record IntradayTimeSeriesPoint(
        LocalDateTime observedAt,
        BigDecimal value
    ) {
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
        BigDecimal reerValue
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
        String status
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
