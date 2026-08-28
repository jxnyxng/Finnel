// Tracks per-source market sync outcomes and derives the final batch status.
package com.example.krwwatcher.service;

class MarketDataSyncRunTracker {

    private int failures;
    private int coreFailures;
    private int skippedSources;
    private final StringBuilder messageSuffix = new StringBuilder();

    void recordSkippedSource(String sourceName) {
        skippedSources++;
        messageSuffix.append(", ").append(sourceName).append("=SKIPPED_COOLDOWN");
    }

    void recordFailure(String sourceName, boolean coreSource, RuntimeException exception) {
        failures++;
        if (coreSource) {
            coreFailures++;
        }
        messageSuffix.append(", ").append(sourceName).append("Error=").append(exception.getClass().getSimpleName());
    }

    String status() {
        if (coreFailures > 0) {
            return "FAILED_CORE_SOURCE";
        }
        if (failures > 0) {
            return "DEGRADED";
        }
        return "SUCCESS";
    }

    String messageSuffix() {
        return messageSuffix.toString();
    }

    int skippedSources() {
        return skippedSources;
    }
}
