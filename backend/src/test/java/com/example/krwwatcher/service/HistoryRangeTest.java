// Tests for dashboard history range parsing and metadata.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HistoryRangeTest {

    @Test
    void parsesSupportedRangeKeysIgnoringCase() {
        assertThat(HistoryRange.from("1y")).isEqualTo(HistoryRange.ONE_YEAR);
        assertThat(HistoryRange.from("3Y")).isEqualTo(HistoryRange.THREE_YEARS);
        assertThat(HistoryRange.from("5Y")).isEqualTo(HistoryRange.FIVE_YEARS);
    }

    @Test
    void defaultsUnknownValuesToThreeYears() {
        assertThat(HistoryRange.from("unknown")).isEqualTo(HistoryRange.THREE_YEARS);
    }

    @Test
    void exposesExistingKeysAndYearCounts() {
        assertThat(HistoryRange.ONE_YEAR.key()).isEqualTo("1Y");
        assertThat(HistoryRange.ONE_YEAR.years()).isEqualTo(1);
    }
}
