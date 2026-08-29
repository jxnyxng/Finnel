package com.example.krwwatcher.service;

import java.time.Instant;

// Dashboard freshness evaluation result shared by response assembly code.
record DashboardFreshnessInfo(
    String freshnessStatus,
    String staleReason,
    Instant expectedNextUpdateAt,
    Instant lastSuccessfulFetchedAt
) {
}
