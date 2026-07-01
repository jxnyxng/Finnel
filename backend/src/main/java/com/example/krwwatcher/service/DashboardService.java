package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

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

    public DailyDashboardResponse daily() {
        DollarIndex latestDollarIndex = dollarIndexRepository.findTopBySeriesIdOrderByBaseDateDesc(properties.fred().dollarIndexSeriesId()).orElse(null);
        InterestRate latestUsRate = interestRateRepository.findTopByCountryCodeAndRateTypeOrderByBaseDateDesc("US", "POLICY_RATE").orElse(null);
        InterestRate latestKrRate = interestRateRepository.findTopByCountryCodeAndRateTypeOrderByBaseDateDesc("KR", "POLICY_RATE").orElse(null);
        ForeignReserve latestForeignReserve = foreignReserveRepository.findTopByOrderByBaseDateDesc().orElse(null);

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

        List<IntradayTimeSeriesPoint> usdKrwIntradaySeries = findLatestIntradaySeries();
        List<TimeSeriesPoint> usdKrwSeries = mergeLatestIntradayPoint(usdKrwDailySeries, usdKrwIntradaySeries);

        TimeSeriesPoint latestUsdKrw = usdKrwSeries.isEmpty() ? null : usdKrwSeries.get(usdKrwSeries.size() - 1);
        LocalDate baseDate = latestUsdKrw != null ? latestUsdKrw.baseDate() : LocalDate.now();

        return new DailyDashboardResponse(
            baseDate,
            List.of(
                metric("USD/KRW", "원/달러 환율", latestUsdKrw == null ? null : latestUsdKrw.value(), "KRW"),
                metric("BROAD_DOLLAR_INDEX", "광의 달러 지수", latestDollarIndex == null ? null : latestDollarIndex.getValue(), "INDEX"),
                metric("US_POLICY_RATE", "미국 기준금리", latestUsRate == null ? null : latestUsRate.getRateValue(), "PERCENT"),
                metric("KR_POLICY_RATE", "한국 기준금리", latestKrRate == null ? null : latestKrRate.getRateValue(), "PERCENT"),
                metric("KR_US_RATE_GAP", "한미 기준금리차", rateGap(latestUsRate, latestKrRate), "PERCENT_POINT"),
                metric("FOREIGN_RESERVES", "대한민국 외환보유액", latestForeignReserve == null ? null : latestForeignReserve.getAmountUsdMillion(), "USD_MILLION")
            ),
            usdKrwSeries,
            usdKrwIntradaySeries,
            dollarIndexSeries
        );
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
        LocalDateTime latestObservedAt = jdbcTemplate.query(
            """
                SELECT MAX(observed_at)
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                """,
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toLocalDateTime(),
            properties.twelveData().usdKrwSymbol()
        ).stream().findFirst().orElse(null);

        if (latestObservedAt == null) {
            return List.of();
        }

        LocalDate sessionStartDate = latestObservedAt.toLocalTime().isBefore(INTRADAY_SESSION_START)
            ? latestObservedAt.toLocalDate().minusDays(1)
            : latestObservedAt.toLocalDate();
        LocalDateTime sessionStart = LocalDateTime.of(sessionStartDate, INTRADAY_SESSION_START);
        LocalDateTime sessionEnd = LocalDateTime.of(sessionStartDate.plusDays(1), INTRADAY_SESSION_END);

        return jdbcTemplate.query(
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
    }

    private MetricSnapshot metric(String code, String label, BigDecimal value, String unit) {
        return new MetricSnapshot(code, label, value, unit, null);
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
        List<TimeSeriesPoint> dollarIndexSeries
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
}
