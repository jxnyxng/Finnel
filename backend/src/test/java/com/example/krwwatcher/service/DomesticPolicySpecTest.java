// Tests for domestic policy indicator metadata normalization.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class DomesticPolicySpecTest {

    @Test
    void defaultsMultiplierToOne() {
        DomesticPolicySpec spec = new DomesticPolicySpec("CPI", "소비자물가지수", "물가 압력", "901Y009", "0", "INDEX", "ECOS:901Y009");

        assertThat(spec.normalizeValue(new BigDecimal("120.5000"))).isEqualByComparingTo("120.5000");
    }

    @Test
    void appliesConfiguredMultiplier() {
        DomesticPolicySpec spec = new DomesticPolicySpec("M2", "M2 통화량", "통화 정책", "161Y005", "BBHS00", "KRW_100M", "ECOS:161Y005", new BigDecimal("10"));

        assertThat(spec.normalizeValue(new BigDecimal("4200000.0000"))).isEqualByComparingTo("42000000.0000");
    }
}
