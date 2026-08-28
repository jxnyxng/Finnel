// Represents supported dashboard history ranges for indicator trend queries.
package com.example.krwwatcher.service;

enum HistoryRange {
    ONE_YEAR("1Y", 1),
    THREE_YEARS("3Y", 3),
    FIVE_YEARS("5Y", 5);

    private final String key;
    private final int years;

    HistoryRange(String key, int years) {
        this.key = key;
        this.years = years;
    }

    String key() {
        return key;
    }

    int years() {
        return years;
    }

    static HistoryRange from(String value) {
        for (HistoryRange range : values()) {
            if (range.key.equalsIgnoreCase(value)) {
                return range;
            }
        }
        return THREE_YEARS;
    }
}
