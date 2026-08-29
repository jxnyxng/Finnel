package com.example.krwwatcher.service;

import java.time.Instant;

// News content freshness evaluation result for response metadata.
record NewsFreshnessInfo(
    String freshnessStatus,
    String staleReason,
    Instant expectedNextUpdateAt,
    Instant lastSuccessfulFetchedAt
) {
}
