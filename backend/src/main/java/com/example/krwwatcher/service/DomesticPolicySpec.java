// Defines ECOS domestic policy indicator metadata and value normalization.
package com.example.krwwatcher.service;

import java.math.BigDecimal;

record DomesticPolicySpec(
    String code,
    String title,
    String category,
    String statCode,
    String itemCode,
    String unit,
    String source,
    BigDecimal multiplier
) {

    DomesticPolicySpec(String code, String title, String category, String statCode, String itemCode, String unit, String source) {
        this(code, title, category, statCode, itemCode, unit, source, BigDecimal.ONE);
    }

    BigDecimal normalizeValue(BigDecimal value) {
        return value.multiply(multiplier);
    }
}
