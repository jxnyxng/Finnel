// Maps USD/KRW intraday points into dashboard chart series.
package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

class DashboardIntradaySeriesMapper {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");

    List<DashboardService.TimeSeriesPoint> mergeLatestIntradayPoint(
        List<DashboardService.TimeSeriesPoint> dailySeries,
        List<DashboardService.IntradayTimeSeriesPoint> intradaySeries
    ) {
        if (intradaySeries.isEmpty()) {
            return dailySeries;
        }

        DashboardService.IntradayTimeSeriesPoint latestIntraday = intradaySeries.get(intradaySeries.size() - 1);
        LocalDate intradayDate = toSeoulDateTime(latestIntraday.observedAt()).toLocalDate();
        DashboardService.TimeSeriesPoint intradayPoint = new DashboardService.TimeSeriesPoint(intradayDate, latestIntraday.value());
        if (dailySeries.isEmpty()) {
            return List.of(intradayPoint);
        }

        DashboardService.TimeSeriesPoint latestDaily = dailySeries.get(dailySeries.size() - 1);
        List<DashboardService.TimeSeriesPoint> mergedSeries = new ArrayList<>(dailySeries);
        if (intradayDate.isAfter(latestDaily.baseDate())) {
            mergedSeries.add(intradayPoint);
        } else if (intradayDate.isEqual(latestDaily.baseDate())) {
            mergedSeries.set(mergedSeries.size() - 1, intradayPoint);
        }

        return mergedSeries;
    }

    List<DashboardService.IntradayCandlestickPoint> buildFiveMinuteIntradayCandles(
        List<DashboardService.IntradayTimeSeriesPoint> series
    ) {
        List<DashboardService.IntradayCandlestickPoint> candles = new ArrayList<>();
        FiveMinuteCandleBuilder current = null;

        for (DashboardService.IntradayTimeSeriesPoint point : series) {
            LocalDateTime observedAt = toSeoulDateTime(point.observedAt());
            LocalDateTime bucketStart = observedAt
                .withMinute((observedAt.getMinute() / 5) * 5)
                .withSecond(0)
                .withNano(0);
            if (current == null || !current.bucketStart().equals(bucketStart)) {
                if (current != null) {
                    candles.add(current.build());
                }
                current = new FiveMinuteCandleBuilder(bucketStart, point);
            } else {
                current.add(point);
            }
        }

        if (current != null) {
            candles.add(current.build());
        }

        return candles;
    }

    private LocalDateTime toSeoulDateTime(Instant instant) {
        return LocalDateTime.ofInstant(instant, SEOUL_ZONE);
    }

    private static class FiveMinuteCandleBuilder {

        private final LocalDateTime bucketStart;
        private final BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal close;
        private Instant fetchedAt;
        private int sourcePointCount;

        private FiveMinuteCandleBuilder(LocalDateTime bucketStart, DashboardService.IntradayTimeSeriesPoint firstPoint) {
            this.bucketStart = bucketStart;
            this.open = firstPoint.open();
            this.high = firstPoint.high();
            this.low = firstPoint.low();
            this.close = firstPoint.value();
            this.fetchedAt = firstPoint.fetchedAt();
            this.sourcePointCount = 1;
        }

        private LocalDateTime bucketStart() {
            return bucketStart;
        }

        private void add(DashboardService.IntradayTimeSeriesPoint point) {
            high = high.max(point.high());
            low = low.min(point.low());
            close = point.value();
            fetchedAt = point.fetchedAt().isAfter(fetchedAt) ? point.fetchedAt() : fetchedAt;
            sourcePointCount++;
        }

        private DashboardService.IntradayCandlestickPoint build() {
            return new DashboardService.IntradayCandlestickPoint(
                bucketStart.plusMinutes(5).atZone(SEOUL_ZONE).toInstant(),
                open,
                high,
                low,
                close,
                sourcePointCount,
                sourcePointCount >= 5,
                fetchedAt
            );
        }
    }
}
