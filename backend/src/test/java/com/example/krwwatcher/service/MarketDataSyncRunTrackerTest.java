// Tests for market sync source outcome aggregation.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MarketDataSyncRunTrackerTest {

    @Test
    void returnsSuccessWhenNoSourceFailed() {
        MarketDataSyncRunTracker tracker = new MarketDataSyncRunTracker();

        assertThat(tracker.status()).isEqualTo("SUCCESS");
        assertThat(tracker.messageSuffix()).isEmpty();
    }

    @Test
    void returnsDegradedWhenOnlyNonCoreSourceFailed() {
        MarketDataSyncRunTracker tracker = new MarketDataSyncRunTracker();

        tracker.recordFailure("optionalSource", false, new IllegalStateException("failed"));

        assertThat(tracker.status()).isEqualTo("DEGRADED");
        assertThat(tracker.messageSuffix()).isEqualTo(", optionalSourceError=IllegalStateException");
    }

    @Test
    void returnsFailedCoreSourceWhenCoreSourceFailed() {
        MarketDataSyncRunTracker tracker = new MarketDataSyncRunTracker();

        tracker.recordFailure("exchange", true, new IllegalArgumentException("failed"));

        assertThat(tracker.status()).isEqualTo("FAILED_CORE_SOURCE");
        assertThat(tracker.messageSuffix()).isEqualTo(", exchangeError=IllegalArgumentException");
    }

    @Test
    void recordsSkippedSourcesInExistingMessageFormat() {
        MarketDataSyncRunTracker tracker = new MarketDataSyncRunTracker();

        tracker.recordSkippedSource("dollarIndex");

        assertThat(tracker.skippedSources()).isEqualTo(1);
        assertThat(tracker.status()).isEqualTo("SUCCESS");
        assertThat(tracker.messageSuffix()).isEqualTo(", dollarIndex=SKIPPED_COOLDOWN");
    }
}
