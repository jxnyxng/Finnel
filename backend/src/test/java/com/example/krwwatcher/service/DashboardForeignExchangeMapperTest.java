// Tests for dashboard exchange-rate display metadata mapping.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class DashboardForeignExchangeMapperTest {

    private final DashboardForeignExchangeMapper mapper = new DashboardForeignExchangeMapper();

    @Test
    void extractsDisplayCodeAndUnitSizeFromParenthesizedCodes() {
        assertThat(mapper.displayCurrencyCode("JPY(100)")).isEqualTo("JPY");
        assertThat(mapper.currencyUnitSize("JPY(100)")).isEqualTo(100);
    }

    @Test
    void fallsBackToRawCodeAndUnitOneForPlainOrInvalidCodes() {
        assertThat(mapper.displayCurrencyCode("USD")).isEqualTo("USD");
        assertThat(mapper.currencyUnitSize("USD")).isEqualTo(1);
        assertThat(mapper.currencyUnitSize("JPY(foo)")).isEqualTo(1);
    }

    @Test
    void keepsDashboardCurrencyOrderWithUnknownCodesLast() {
        assertThat(mapper.order("USD")).isLessThan(mapper.order("JPY"));
        assertThat(mapper.order("SGD")).isLessThan(mapper.order("ZZZ"));
    }

    @Test
    void mapsStoredExchangeRateToDashboardRecord() {
        DashboardService.ForeignExchangeRate rate = mapper.toForeignExchangeRate(
            LocalDate.of(2026, 8, 27),
            "JPY(100)",
            "Japanese Yen",
            new BigDecimal("950.0000"),
            "FRED:DEXJPUS",
            Instant.parse("2026-08-27T03:30:00Z"),
            LocalDate.of(1999, 1, 1),
            LocalDate.of(2026, 8, 27)
        );

        assertThat(rate.currencyCode()).isEqualTo("JPY(100)");
        assertThat(rate.displayCode()).isEqualTo("JPY");
        assertThat(rate.unitSize()).isEqualTo(100);
    }
}
