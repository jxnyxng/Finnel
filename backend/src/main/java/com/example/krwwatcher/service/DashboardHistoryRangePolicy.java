// Selects supported dashboard history ranges from available data coverage.
package com.example.krwwatcher.service;

import java.time.LocalDate;
import java.util.List;

class DashboardHistoryRangePolicy {

    List<HistoryRange> availableHistoryRanges(LocalDate earliestDate, LocalDate endDate) {
        if (earliestDate == null) {
            return List.of();
        }

        return List.of(HistoryRange.ONE_YEAR, HistoryRange.THREE_YEARS, HistoryRange.FIVE_YEARS).stream()
            .filter(range -> !earliestDate.isAfter(endDate.minusYears(range.years()).plusDays(45)))
            .toList();
    }

    HistoryRange selectRange(String requestedRangeKey, List<HistoryRange> availableRanges) {
        HistoryRange requestedRange = HistoryRange.from(requestedRangeKey);
        return availableRanges.contains(requestedRange)
            ? requestedRange
            : availableRanges.stream().reduce((first, second) -> second).orElse(requestedRange);
    }
}
