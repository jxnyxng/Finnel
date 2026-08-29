package com.example.krwwatcher.service;

import java.time.Instant;
import java.time.LocalDateTime;

// Decision returned before attempting a USD/KRW intraday backfill session.
record MarketDataBackfillSessionDecision(
    boolean canAttempt,
    String sessionKey,
    String status,
    LocalDateTime latestObservedAt,
    int noChangeCount,
    Instant nextAllowedAt,
    String message
) {
}
