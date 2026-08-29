package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

class NewsResponseBuilderTest {

    private final NewsResponseBuilder builder = new NewsResponseBuilder();

    @Test
    void normalizesPageAndPageSizeWithinConfiguredLimit() {
        assertThat(builder.normalizePage(0, 100, 10)).isEqualTo(new NewsPageRequest(1, 10, 0));
        assertThat(builder.normalizePage(3, 5, 10)).isEqualTo(new NewsPageRequest(3, 5, 10));
        assertThat(builder.normalizePage(2, 0, 10)).isEqualTo(new NewsPageRequest(2, 1, 1));
    }

    @Test
    void buildsNewsResponseWithPaginationFreshnessAndSyncMetadata() {
        NewsService.NewsArticle article = new NewsService.NewsArticle(
            "fx",
            "환율",
            "원달러 환율",
            "원달러 환율 상승",
            "환율 설명",
            null,
            "https://news.example.com/a",
            null,
            Instant.parse("2026-08-29T00:00:00Z"),
            null,
            null,
            Instant.parse("2026-08-29T00:01:00Z"),
            null
        );
        NewsFreshnessInfo freshness = new NewsFreshnessInfo(
            "FRESH",
            null,
            Instant.parse("2026-08-29T01:01:00Z"),
            Instant.parse("2026-08-29T00:01:00Z")
        );
        NewsLatestSyncAttempt syncAttempt = new NewsLatestSyncAttempt(
            "SUCCESS",
            Instant.parse("2026-08-29T00:00:00Z"),
            Instant.parse("2026-08-29T00:01:00Z")
        );

        NewsService.NewsResponse response = builder.build(
            true,
            List.of(new NewsService.NewsCategory("fx", "환율", "원달러 환율", 12)),
            List.of(article),
            new NewsPageRequest(2, 10, 10),
            21,
            freshness,
            syncAttempt
        );

        assertThat(response.configured()).isTrue();
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
