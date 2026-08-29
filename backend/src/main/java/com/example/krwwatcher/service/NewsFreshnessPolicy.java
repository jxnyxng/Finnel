package com.example.krwwatcher.service;

import java.time.Duration;
import java.time.Instant;

// Evaluates freshness metadata for news content responses.
class NewsFreshnessPolicy {

    private static final Duration FRESHNESS_MAX_AGE = Duration.ofMinutes(60);

    NewsFreshnessInfo contentFreshness(Instant lastSuccessfulFetchedAt, NewsLatestSyncAttempt latestSyncAttempt, Instant now) {
        if (latestSyncAttempt != null && isFailedSyncStatus(latestSyncAttempt.status())) {
            return new NewsFreshnessInfo("STALE", "마지막 뉴스 업데이트 시도가 실패했습니다.", latestSyncAttempt.endedAt(), lastSuccessfulFetchedAt);
        }

        if (lastSuccessfulFetchedAt == null) {
            return new NewsFreshnessInfo("MISSING", "저장된 최신 수집값이 없습니다.", null, null);
        }

        Instant expectedNextUpdateAt = lastSuccessfulFetchedAt.plus(FRESHNESS_MAX_AGE);
        if (now.isAfter(expectedNextUpdateAt)) {
            return new NewsFreshnessInfo("STALE", "뉴스 수집이 60분 이상 지연되었습니다.", expectedNextUpdateAt, lastSuccessfulFetchedAt);
        }

        return new NewsFreshnessInfo("FRESH", null, expectedNextUpdateAt, lastSuccessfulFetchedAt);
    }

    private boolean isFailedSyncStatus(String status) {
        return status != null && !"SUCCESS".equals(status) && !"RUNNING".equals(status);
    }
}
