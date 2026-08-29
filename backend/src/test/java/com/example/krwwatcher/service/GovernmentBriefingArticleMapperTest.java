package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class GovernmentBriefingArticleMapperTest {

    private final GovernmentBriefingArticleMapper mapper = new GovernmentBriefingArticleMapper();

    @Test
    void mapsResultSetColumnsToArticleFields() throws Exception {
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("title")).thenReturn("환율 정책 브리핑");
        when(resultSet.getString("subtitle")).thenReturn("외환시장 안정");
        when(resultSet.getString("body")).thenReturn("본문");
        when(resultSet.getString("ministry")).thenReturn("기획재정부");
        when(resultSet.getString("category")).thenReturn("fx");
        when(resultSet.getTimestamp("published_at")).thenReturn(Timestamp.from(Instant.parse("2026-08-29T00:00:00Z")));
        when(resultSet.getString("thumbnail_url")).thenReturn("https://image.example.com/thumb.jpg");
        when(resultSet.getString("image_url")).thenReturn("https://image.example.com/main.jpg");
        when(resultSet.getString("original_url")).thenReturn("https://briefing.example.com/a");
        when(resultSet.getString("kogl_type")).thenReturn("KOG License Type 1");
        when(resultSet.getTimestamp("fetched_at")).thenReturn(Timestamp.from(Instant.parse("2026-08-29T00:01:00Z")));

        GovernmentBriefingService.GovernmentBriefingArticle article = mapper.mapArticle(resultSet);

        assertThat(article.title()).isEqualTo("환율 정책 브리핑");
        assertThat(article.subtitle()).isEqualTo("외환시장 안정");
        assertThat(article.body()).isEqualTo("본문");
        assertThat(article.ministry()).isEqualTo("기획재정부");
        assertThat(article.category()).isEqualTo("fx");
        assertThat(article.publishedAt()).isEqualTo(Instant.parse("2026-08-29T00:00:00Z"));
        assertThat(article.thumbnailUrl()).isEqualTo("https://image.example.com/thumb.jpg");
        assertThat(article.imageUrl()).isEqualTo("https://image.example.com/main.jpg");
        assertThat(article.originalUrl()).isEqualTo("https://briefing.example.com/a");
        assertThat(article.koglType()).isEqualTo("KOG License Type 1");
        assertThat(article.fetchedAt()).isEqualTo(Instant.parse("2026-08-29T00:01:00Z"));
    }

    @Test
    void keepsNullablePublishedAt() throws Exception {
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getTimestamp("published_at")).thenReturn(null);
        when(resultSet.getTimestamp("fetched_at")).thenReturn(Timestamp.from(Instant.parse("2026-08-29T00:01:00Z")));

        GovernmentBriefingService.GovernmentBriefingArticle article = mapper.mapArticle(resultSet);

        assertThat(article.publishedAt()).isNull();
        assertThat(article.fetchedAt()).isEqualTo(Instant.parse("2026-08-29T00:01:00Z"));
    }
}
