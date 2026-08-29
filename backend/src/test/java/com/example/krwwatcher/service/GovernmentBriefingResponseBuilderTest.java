package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

class GovernmentBriefingResponseBuilderTest {

    private final GovernmentBriefingResponseBuilder builder = new GovernmentBriefingResponseBuilder();

    @Test
    void normalizesPageAndPageSizeWithinConfiguredLimit() {
        assertThat(builder.normalizePage(0, 100, 30)).isEqualTo(new GovernmentBriefingPageRequest(1, 30, 0));
        assertThat(builder.normalizePage(3, 20, 30)).isEqualTo(new GovernmentBriefingPageRequest(3, 20, 40));
        assertThat(builder.normalizePage(2, 0, 30)).isEqualTo(new GovernmentBriefingPageRequest(2, 1, 1));
    }

    @Test
    void buildsResponseWithPaginationFreshnessAndSyncMetadata() {
        GovernmentBriefingService.GovernmentBriefingArticle article = new GovernmentBriefingService.GovernmentBriefingArticle(
            "환율 정책 브리핑",
            "외환시장 안정",
            "본문",
            "기획재정부",
            "fx",
            Instant.parse("2026-08-29T00:00:00Z"),
            "https://image.example.com/thumb.jpg",
            "https://image.example.com/main.jpg",
            "https://briefing.example.com/a",
            "KOG License Type 1",
            Instant.parse("2026-08-29T00:01:00Z")
        );
        GovernmentBriefingService.FreshnessInfo freshness = new GovernmentBriefingService.FreshnessInfo(
            "FRESH",
            null,
            Instant.parse("2026-08-29T01:01:00Z"),
            Instant.parse("2026-08-29T00:01:00Z")
        );
        GovernmentBriefingService.LatestSyncAttempt syncAttempt = new GovernmentBriefingService.LatestSyncAttempt(
            "SUCCESS",
            Instant.parse("2026-08-29T00:00:00Z"),
            Instant.parse("2026-08-29T00:01:00Z")
        );

        GovernmentBriefingService.GovernmentBriefingResponse response = builder.build(
            true,
            List.of(new GovernmentBriefingService.GovernmentBriefingCategory("fx", "외환·금융시장", 11)),
            List.of(article),
            new GovernmentBriefingPageRequest(2, 10, 10),
            21,
            freshness,
            syncAttempt
        );

        assertThat(response.configured()).isTrue();
        assertThat(response.categories()).containsExactly(new GovernmentBriefingService.GovernmentBriefingCategory("fx", "외환·금융시장", 11));
        assertThat(response.articles()).containsExactly(article);
        assertThat(response.page()).isEqualTo(2);
        assertThat(response.pageSize()).isEqualTo(10);
        assertThat(response.totalCount()).isEqualTo(21);
        assertThat(response.totalPages()).isEqualTo(3);
        assertThat(response.freshnessStatus()).isEqualTo("FRESH");
        assertThat(response.expectedNextUpdateAt()).isEqualTo(Instant.parse("2026-08-29T01:01:00Z"));
        assertThat(response.latestSyncStatus()).isEqualTo("SUCCESS");
        assertThat(response.latestSyncEndedAt()).isEqualTo(Instant.parse("2026-08-29T00:01:00Z"));
    }
}
