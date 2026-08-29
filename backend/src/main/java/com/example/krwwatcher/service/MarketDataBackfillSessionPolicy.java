package com.example.krwwatcher.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

// Decides USD/KRW intraday backfill session retry, cooldown, and suspension state.
class MarketDataBackfillSessionPolicy {

    static final String STATUS_BACKFILLED = "BACKFILLED";
    static final String STATUS_NO_CHANGE = "NO_CHANGE";
    static final String STATUS_SKIPPED_COOLDOWN = "SKIPPED_SESSION_COOLDOWN";
    static final String STATUS_SKIPPED_SUSPENDED = "SKIPPED_SESSION_SUSPENDED";

    boolean needsBackfill(LocalDate sessionStartDate, LocalDateTime latestObservedAt) {
        return latestObservedAt == null || isSessionIncomplete(sessionStartDate, latestObservedAt);
    }

    boolean isSessionIncomplete(LocalDate sessionStartDate, LocalDateTime latestObservedAt) {
        LocalDateTime expectedSessionEnd = UsdKrwIntradaySession.endDateTime(sessionStartDate).minusMinutes(5);
        return latestObservedAt.isBefore(expectedSessionEnd);
    }

    MarketDataBackfillSessionDecision decideBackfillSession(
        LocalDate sessionStartDate,
        String sessionKey,
        MarketDataUsdKrwBackfillAttempt latestAttempt,
        LocalDateTime latestObservedAt,
        Instant now,
        int suspendThreshold,
        boolean bypassSuspension
    ) {
        if (latestAttempt == null) {
            return new MarketDataBackfillSessionDecision(true, sessionKey, null, latestObservedAt, 0, null, null);
        }

        if (latestAttempt.nextAllowedAt() != null && now.isBefore(latestAttempt.nextAllowedAt())) {
            return new MarketDataBackfillSessionDecision(
                false,
                sessionKey,
                STATUS_SKIPPED_COOLDOWN,
                latestObservedAt,
                latestAttempt.noChangeCount(),
                latestAttempt.nextAllowedAt(),
                "session retry cooldown active"
            );
        }

        if (suspendThreshold > 0 && latestAttempt.noChangeCount() >= suspendThreshold && !bypassSuspension) {
            return new MarketDataBackfillSessionDecision(
                false,
                sessionKey,
                STATUS_SKIPPED_SUSPENDED,
                latestObservedAt,
                latestAttempt.noChangeCount(),
                latestAttempt.nextAllowedAt(),
                "no-change threshold reached"
            );
        }

        return new MarketDataBackfillSessionDecision(true, sessionKey, null, latestObservedAt, latestAttempt.noChangeCount(), null, null);
    }

    String formatBackfillMessage(String sessionKey, String status, String message) {
        return "backfillSession=" + sessionKey + ", backfillStatus=" + status + (message == null ? "" : ", backfillMessage=" + message);
    }
}
