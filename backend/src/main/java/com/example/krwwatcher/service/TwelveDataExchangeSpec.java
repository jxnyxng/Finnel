// Defines Twelve Data exchange symbols and their display-rate conversion.
package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

record TwelveDataExchangeSpec(String symbol, String currencyCode, String currencyName, BigDecimal displayUnit) {

    BigDecimal toDisplayRate(BigDecimal rate) {
        return rate.multiply(displayUnit).setScale(4, RoundingMode.HALF_UP);
    }
}
