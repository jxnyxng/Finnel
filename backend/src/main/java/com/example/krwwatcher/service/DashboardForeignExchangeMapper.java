// Maps stored exchange-rate codes into dashboard display metadata.
package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

class DashboardForeignExchangeMapper {

    private static final List<String> FOREIGN_EXCHANGE_ORDER = List.of("USD", "JPY", "EUR", "CNY", "CNH", "GBP", "AUD", "CAD", "CHF", "HKD", "SGD");

    DashboardService.ForeignExchangeRate toForeignExchangeRate(
        LocalDate baseDate,
        String rawCode,
        String currencyName,
        BigDecimal dealBasRate,
        String source,
        Instant fetchedAt,
        LocalDate historyStartDate,
        LocalDate historyEndDate
    ) {
        return new DashboardService.ForeignExchangeRate(
            baseDate,
            rawCode,
            displayCurrencyCode(rawCode),
            currencyName,
            dealBasRate,
            currencyUnitSize(rawCode),
            source,
            fetchedAt,
            historyStartDate,
            historyEndDate
        );
    }

    int order(String currencyCode) {
        int index = FOREIGN_EXCHANGE_ORDER.indexOf(currencyCode);
        return index < 0 ? FOREIGN_EXCHANGE_ORDER.size() : index;
    }

    String displayCurrencyCode(String rawCode) {
        int parenthesisIndex = rawCode.indexOf('(');
        return parenthesisIndex < 0 ? rawCode : rawCode.substring(0, parenthesisIndex);
    }

    int currencyUnitSize(String rawCode) {
        int start = rawCode.indexOf('(');
        int end = rawCode.indexOf(')');
        if (start < 0 || end <= start + 1) {
            return 1;
        }

        try {
            return Integer.parseInt(rawCode.substring(start + 1, end));
        } catch (NumberFormatException exception) {
            return 1;
        }
    }
}
