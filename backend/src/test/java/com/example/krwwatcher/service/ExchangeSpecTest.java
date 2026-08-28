// Tests for exchange-rate spec display and FRED cross-rate conversion rules.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class ExchangeSpecTest {

    @Test
    void twelveDataSpecAppliesDisplayUnitForHundredYen() {
        TwelveDataExchangeSpec spec = new TwelveDataExchangeSpec("JPY/KRW", "JPY(100)", "Japanese Yen", BigDecimal.valueOf(100));

        assertThat(spec.toDisplayRate(new BigDecimal("9.876543"))).isEqualByComparingTo("987.6543");
    }

    @Test
    void fredSpecConvertsUsdPerForeignUnitRatesToKrw() {
        FredExchangeSpec spec = new FredExchangeSpec("EUR", "Euro", "DEXUSEU", true, BigDecimal.ONE);

        assertThat(spec.toKrwRate(new BigDecimal("1400.0000"), new BigDecimal("1.2500"))).isEqualByComparingTo("1750.0000");
    }

    @Test
    void fredSpecConvertsForeignUnitsPerUsdRatesToKrw() {
        FredExchangeSpec spec = new FredExchangeSpec("JPY(100)", "Japanese Yen", "DEXJPUS", false, BigDecimal.valueOf(100));

        assertThat(spec.toKrwRate(new BigDecimal("1400.0000"), new BigDecimal("140.0000"))).isEqualByComparingTo("1000.0000");
    }
}
