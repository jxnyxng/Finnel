// Tests for dashboard exchange-calculator date bounds.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

class DashboardExchangeCalculatorMetaBuilderTest {

    private final DashboardExchangeCalculatorMetaBuilder builder = new DashboardExchangeCalculatorMetaBuilder();

    @Test
    void usesExtremesFromRateHistoryBounds() {
        DashboardService.ExchangeRateCalculatorMeta meta = builder.exchangeRateCalculatorMeta(
            List.of(
                rate("USD", "2020-01-01", "2026-08-20"),
                rate("JPY", "1999-01-01", "2026-08-28")
            ),
            LocalDate.of(2026, 8, 29)
        );

        assertThat(meta.earliestAllowedDate()).isEqualTo(LocalDate.of(1999, 1, 1));
        assertThat(meta.latestAllowedDate()).isEqualTo(LocalDate.of(2026, 8, 28));
    }

    @Test
    void fallsBackToFiveYearsBeforeLatestDateWhenHistoryStartIsMissing() {
        DashboardService.ExchangeRateCalculatorMeta meta = builder.exchangeRateCalculatorMeta(
            List.of(rate("USD", null, null)),
            LocalDate.of(2026, 8, 29)
        );

        assertThat(meta.latestAllowedDate()).isEqualTo(LocalDate.of(2026, 8, 29));
        assertThat(meta.earliestAllowedDate()).isEqualTo(LocalDate.of(2021, 8, 29));
    }

    private DashboardService.ForeignExchangeRate rate(String code, String historyStartDate, String historyEndDate) {
        return new DashboardService.ForeignExchangeRate(
            LocalDate.of(2026, 8, 28),
            code,
            code,
            "미국 달러",
            new BigDecimal("1390.0000"),
            1,
            "SOURCE",
            Instant.parse("2026-08-28T00:00:00Z"),
            historyStartDate == null ? null : LocalDate.parse(historyStartDate),
            historyEndDate == null ? null : LocalDate.parse(historyEndDate)
        );
    }
}
