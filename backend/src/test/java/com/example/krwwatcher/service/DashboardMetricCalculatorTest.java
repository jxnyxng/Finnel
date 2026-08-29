// Tests for dashboard metric calculation helpers.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

class DashboardMetricCalculatorTest {

    private final DashboardMetricCalculator calculator = new DashboardMetricCalculator();

    @Test
    void calculatesPercentageChangeFromLastTwoPoints() {
        assertThat(calculator.changeRate(List.of(
            point("2026-08-26", "100.0000"),
            point("2026-08-27", "110.0000")
        ))).isEqualByComparingTo("10.000000");
    }

    @Test
    void returnsNullChangeRateWhenSeriesCannotBeCompared() {
        assertThat(calculator.changeRate(null)).isNull();
        assertThat(calculator.changeRate(List.of(point("2026-08-27", "110.0000")))).isNull();
        assertThat(calculator.changeRate(List.of(
            point("2026-08-26", "0.0000"),
            point("2026-08-27", "110.0000")
        ))).isNull();
    }

    @Test
    void averagesPointsWithExistingScale() {
        assertThat(calculator.average(List.of(
            point("2026-08-25", "1.0000"),
            point("2026-08-26", "2.0000")
        ))).isEqualByComparingTo("1.500000");
        assertThat(calculator.average(List.of())).isNull();
    }

    @Test
    void calculatesRateGapAsUsMinusKr() {
        assertThat(calculator.rateGap(new BigDecimal("5.5000"), new BigDecimal("3.5000"))).isEqualByComparingTo("2.0000");
        assertThat(calculator.rateGap(null, new BigDecimal("3.5000"))).isNull();
        assertThat(calculator.rateGap(new BigDecimal("5.5000"), null)).isNull();
    }

    @Test
    void returnsOldestPresentInstant() {
        Instant older = Instant.parse("2026-08-27T00:00:00Z");
        Instant newer = Instant.parse("2026-08-27T01:00:00Z");

        assertThat(calculator.oldestInstant(older, newer)).isEqualTo(older);
        assertThat(calculator.oldestInstant(null, newer)).isEqualTo(newer);
        assertThat(calculator.oldestInstant(older, null)).isEqualTo(older);
    }

    private DashboardService.TimeSeriesPoint point(String date, String value) {
        return new DashboardService.TimeSeriesPoint(LocalDate.parse(date), new BigDecimal(value));
    }
}
