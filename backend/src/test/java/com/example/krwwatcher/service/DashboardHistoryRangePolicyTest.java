// Tests for dashboard history range availability and fallback selection.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

class DashboardHistoryRangePolicyTest {

    private final DashboardHistoryRangePolicy policy = new DashboardHistoryRangePolicy();

    @Test
    void returnsEmptyRangesWhenNoHistoryExists() {
        assertThat(policy.availableHistoryRanges(null, LocalDate.of(2026, 8, 29))).isEmpty();
    }

    @Test
    void keepsExistingFortyFiveDayCoverageGrace() {
        LocalDate endDate = LocalDate.of(2026, 8, 29);

        assertThat(policy.availableHistoryRanges(LocalDate.of(2025, 10, 13), endDate))
            .containsExactly(HistoryRange.ONE_YEAR);
        assertThat(policy.availableHistoryRanges(LocalDate.of(2025, 10, 14), endDate))
            .isEmpty();
    }

    @Test
    void selectsRequestedRangeWhenAvailable() {
        assertThat(policy.selectRange("1Y", List.of(HistoryRange.ONE_YEAR, HistoryRange.THREE_YEARS)))
            .isEqualTo(HistoryRange.ONE_YEAR);
    }

    @Test
    void fallsBackToLongestAvailableRangeWhenRequestedRangeIsUnavailable() {
        assertThat(policy.selectRange("5Y", List.of(HistoryRange.ONE_YEAR, HistoryRange.THREE_YEARS)))
            .isEqualTo(HistoryRange.THREE_YEARS);
    }

    @Test
    void keepsParsedDefaultWhenNoRangesAreAvailable() {
        assertThat(policy.selectRange("unknown", List.of())).isEqualTo(HistoryRange.THREE_YEARS);
    }
}
