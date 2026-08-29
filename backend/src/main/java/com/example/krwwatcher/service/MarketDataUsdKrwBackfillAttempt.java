package com.example.krwwatcher.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

// Persisted USD/KRW intraday backfill attempt state used for retry decisions.
record MarketDataUsdKrwBackfillAttempt(
    String sessionKey,
    LocalDate sessionStartDate,
    String status,
    int rows,
    LocalDateTime previousLatestObservedAt,
    LocalDateTime latestObservedAt,
    int noChangeCount,
    Instant attemptedAt,
    Instant nextAllowedAt,
    String message
) {
}
