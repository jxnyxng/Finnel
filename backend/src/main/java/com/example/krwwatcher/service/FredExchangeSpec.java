// Defines FRED cross-rate metadata and USD/KRW conversion for daily exchange rates.
package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

record FredExchangeSpec(String currencyCode, String currencyName, String seriesId, boolean usdPerForeignUnit, BigDecimal displayUnit) {

    BigDecimal toKrwRate(BigDecimal usdKrwRate, BigDecimal fredRate) {
        if (usdPerForeignUnit) {
            return usdKrwRate.multiply(fredRate).multiply(displayUnit).setScale(4, RoundingMode.HALF_UP);
        }

        return usdKrwRate.divide(fredRate, 8, RoundingMode.HALF_UP).multiply(displayUnit).setScale(4, RoundingMode.HALF_UP);
    }
}
