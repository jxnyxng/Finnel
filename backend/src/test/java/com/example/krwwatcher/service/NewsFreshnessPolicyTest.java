package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

class NewsFreshnessPolicyTest {

    private final NewsFreshnessPolicy policy = new NewsFreshnessPolicy();

    @Test
    void failedLatestSyncMarksNewsStale() {
        Instant lastFetchedAt = Instant.parse("2026-08-29T00:00:00Z");

        NewsFreshnessInfo freshness = policy.contentFreshness(
            lastFetchedAt,
            new NewsLatestSyncAttempt("FAILED", Instant.parse("2026-08-29T00:30:00Z"), Instant.parse("2026-08-29T00:31:00Z")),
            Instant.parse("2026-08-29T00:40:00Z")
        );

        assertThat(freshness.freshnessStatus()).isEqualTo("STALE");
        assertThat(freshness.staleReason()).isEqualTo("마지막 뉴스 업데이트 시도가 실패했습니다.");
        assertThat(freshness.expectedNextUpdateAt()).isEqualTo(Instant.parse("2026-08-29T00:31:00Z"));
        assertThat(freshness.lastSuccessfulFetchedAt()).isEqualTo(lastFetchedAt);
    }

    @Test
    void missingLatestFetchMarksNewsMissing() {
        NewsFreshnessInfo freshness = policy.contentFreshness(null, null, Instant.parse("2026-08-29T00:40:00Z"));

        assertThat(freshness.freshnessStatus()).isEqualTo("MISSING");
        assertThat(freshness.staleReason()).isEqualTo("저장된 최신 수집값이 없습니다.");
        assertThat(freshness.expectedNextUpdateAt()).isNull();
        assertThat(freshness.lastSuccessfulFetchedAt()).isNull();
    }

    @Test
    void latestFetchOlderThanSixtyMinutesMarksNewsStale() {
        Instant lastFetchedAt = Instant.parse("2026-08-29T00:00:00Z");

        NewsFreshnessInfo freshness = policy.contentFreshness(
            lastFetchedAt,
            new NewsLatestSyncAttempt("SUCCESS", Instant.parse("2026-08-29T00:00:00Z"), Instant.parse("2026-08-29T00:01:00Z")),
            Instant.parse("2026-08-29T01:00:01Z")
        );

        assertThat(freshness.freshnessStatus()).isEqualTo("STALE");
        assertThat(freshness.staleReason()).isEqualTo("뉴스 수집이 60분 이상 지연되었습니다.");
        assertThat(freshness.expectedNextUpdateAt()).isEqualTo(Instant.parse("2026-08-29T01:00:00Z"));
        assertThat(freshness.lastSuccessfulFetchedAt()).isEqualTo(lastFetchedAt);
    }

    @Test
    void recentLatestFetchMarksNewsFresh() {
        Instant lastFetchedAt = Instant.parse("2026-08-29T00:00:00Z");

        NewsFreshnessInfo freshness = policy.contentFreshness(
            lastFetchedAt,
            new NewsLatestSyncAttempt("RUNNING", Instant.parse("2026-08-29T00:30:00Z"), null),
            Instant.parse("2026-08-29T00:59:59Z")
        );

        assertThat(freshness.freshnessStatus()).isEqualTo("FRESH");
        assertThat(freshness.staleReason()).isNull();
        assertThat(freshness.expectedNextUpdateAt()).isEqualTo(Instant.parse("2026-08-29T01:00:00Z"));
        assertThat(freshness.lastSuccessfulFetchedAt()).isEqualTo(lastFetchedAt);
    }
}
