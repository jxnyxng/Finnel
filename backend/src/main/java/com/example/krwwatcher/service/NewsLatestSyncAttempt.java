package com.example.krwwatcher.service;

import java.time.Instant;

// Latest news sync attempt state used for content freshness metadata.
record NewsLatestSyncAttempt(
    String status,
    Instant startedAt,
    Instant endedAt
) {
}
