// Tests for dashboard intraday chart series mapping.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

class DashboardIntradaySeriesMapperTest {

    private final DashboardIntradaySeriesMapper mapper = new DashboardIntradaySeriesMapper();

    @Test
    void replacesSameDateDailyPointWithLatestIntradayValue() {
        List<DashboardService.TimeSeriesPoint> merged = mapper.mergeLatestIntradayPoint(
            List.of(
                point("2026-08-27", "1380.0000"),
                point("2026-08-28", "1390.0000")
            ),
            List.of(intraday("2026-08-28T05:10:00Z", "1391.0000", "1393.0000", "1389.0000", "1392.0000", "2026-08-28T05:10:30Z"))
        );

        assertThat(merged).hasSize(2);
        assertThat(merged.get(1).baseDate()).isEqualTo(LocalDate.of(2026, 8, 28));
        assertThat(merged.get(1).value()).isEqualByComparingTo("1392.0000");
    }

    @Test
    void appendsIntradayPointWhenItIsNewerThanDailySeries() {
        List<DashboardService.TimeSeriesPoint> merged = mapper.mergeLatestIntradayPoint(
            List.of(point("2026-08-27", "1380.0000")),
            List.of(intraday("2026-08-28T05:10:00Z", "1391.0000", "1393.0000", "1389.0000", "1392.0000", "2026-08-28T05:10:30Z"))
        );

        assertThat(merged).extracting(DashboardService.TimeSeriesPoint::baseDate)
            .containsExactly(LocalDate.of(2026, 8, 27), LocalDate.of(2026, 8, 28));
    }

    @Test
    void buildsFiveMinuteCandlesFromOneMinutePoints() {
        List<DashboardService.IntradayCandlestickPoint> candles = mapper.buildFiveMinuteIntradayCandles(List.of(
            intraday("2026-08-28T00:00:00Z", "1390.0000", "1391.0000", "1389.0000", "1390.5000", "2026-08-28T00:00:30Z"),
            intraday("2026-08-28T00:01:00Z", "1390.5000", "1392.0000", "1388.0000", "1391.0000", "2026-08-28T00:01:30Z"),
            intraday("2026-08-28T00:02:00Z", "1391.0000", "1393.0000", "1390.0000", "1392.0000", "2026-08-28T00:02:30Z"),
            intraday("2026-08-28T00:03:00Z", "1392.0000", "1394.0000", "1391.0000", "1393.0000", "2026-08-28T00:03:30Z"),
            intraday("2026-08-28T00:04:00Z", "1393.0000", "1395.0000", "1392.0000", "1394.0000", "2026-08-28T00:04:30Z"),
            intraday("2026-08-28T00:05:00Z", "1394.0000", "1396.0000", "1393.0000", "1395.0000", "2026-08-28T00:05:30Z")
        ));

        assertThat(candles).hasSize(2);
        DashboardService.IntradayCandlestickPoint first = candles.get(0);
        assertThat(first.observedAt()).isEqualTo(Instant.parse("2026-08-28T00:05:00Z"));
        assertThat(first.open()).isEqualByComparingTo("1390.0000");
        assertThat(first.high()).isEqualByComparingTo("1395.0000");
        assertThat(first.low()).isEqualByComparingTo("1388.0000");
        assertThat(first.close()).isEqualByComparingTo("1394.0000");
        assertThat(first.sourcePointCount()).isEqualTo(5);
        assertThat(first.complete()).isTrue();
        assertThat(first.fetchedAt()).isEqualTo(Instant.parse("2026-08-28T00:04:30Z"));

        assertThat(candles.get(1).sourcePointCount()).isEqualTo(1);
        assertThat(candles.get(1).complete()).isFalse();
    }

    private DashboardService.TimeSeriesPoint point(String date, String value) {
        return new DashboardService.TimeSeriesPoint(LocalDate.parse(date), new BigDecimal(value));
    }

    private DashboardService.IntradayTimeSeriesPoint intraday(
        String observedAt,
        String open,
        String high,
        String low,
        String close,
        String fetchedAt
    ) {
        return new DashboardService.IntradayTimeSeriesPoint(
            Instant.parse(observedAt),
            new BigDecimal(open),
            new BigDecimal(high),
            new BigDecimal(low),
            new BigDecimal(close),
            Instant.parse(fetchedAt)
        );
    }
}
