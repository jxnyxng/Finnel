// Calculates dashboard metric changes and aggregate values.
package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

class DashboardMetricCalculator {

    BigDecimal changeRate(List<DashboardService.TimeSeriesPoint> series) {
        if (series == null || series.size() < 2) {
            return null;
        }

        DashboardService.TimeSeriesPoint latest = series.get(series.size() - 1);
        DashboardService.TimeSeriesPoint previous = series.get(series.size() - 2);
        if (latest.value() == null || previous.value() == null || BigDecimal.ZERO.compareTo(previous.value()) == 0) {
            return null;
        }

        return latest.value()
            .subtract(previous.value())
            .multiply(BigDecimal.valueOf(100))
            .divide(previous.value(), 6, RoundingMode.HALF_UP);
    }

    BigDecimal average(List<DashboardService.TimeSeriesPoint> points) {
        if (points.isEmpty()) {
            return null;
        }

        BigDecimal sum = points.stream()
            .map(DashboardService.TimeSeriesPoint::value)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(points.size()), 6, RoundingMode.HALF_UP);
    }

    Instant oldestInstant(Instant left, Instant right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return left.isBefore(right) ? left : right;
    }
}
