package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;

import com.example.krwwatcher.service.news.NewsArticleSearchCriteria;
import org.junit.jupiter.api.Test;

class NewsArticleQuerySupportTest {

    private final NewsArticleQuerySupport querySupport = new NewsArticleQuerySupport();

    @Test
    void trimsAndLimitsSearchKeyword() {
        assertThat(querySupport.normalizeSearchKeyword("  환율  ", 80)).isEqualTo("환율");
        assertThat(querySupport.normalizeSearchKeyword("abcdef", 3)).isEqualTo("abc");
        assertThat(querySupport.normalizeSearchKeyword("   ", 80)).isNull();
    }

    @Test
    void buildsArticleWhereClauseWithDateRangeAndEscapedKeyword() {
        NewsArticleQuerySupport.ArticleWhereClause whereClause = querySupport.buildArticleWhereClause(
            new NewsArticleSearchCriteria(
                "fx",
                LocalDate.of(2026, 7, 20),
                LocalDate.of(2026, 7, 21),
                "원_%!"
            )
        );

        assertThat(whereClause.sql()).isEqualTo("WHERE category_code = ? AND published_at >= ? AND published_at < ? AND (title LIKE ? ESCAPE '!' OR description LIKE ? ESCAPE '!')");
        assertThat(whereClause.params()).containsExactly(
            "fx",
            Instant.parse("2026-07-19T15:00:00Z"),
            Instant.parse("2026-07-21T15:00:00Z"),
            "%원!_!%!!%",
            "%원!_!%!!%"
        );
    }

    @Test
    void omitsAllCategoryAndEmptyFilters() {
        NewsArticleQuerySupport.ArticleWhereClause whereClause = querySupport.buildArticleWhereClause(
            new NewsArticleSearchCriteria("all", null, null, null)
        );

        assertThat(whereClause.sql()).isEmpty();
        assertThat(whereClause.params()).isEmpty();
    }
}
