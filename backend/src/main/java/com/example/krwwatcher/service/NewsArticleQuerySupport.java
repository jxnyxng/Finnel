package com.example.krwwatcher.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import com.example.krwwatcher.service.news.NewsArticleSearchCriteria;
import org.springframework.util.StringUtils;

// Builds news article query filters and maps article rows to response records.
class NewsArticleQuerySupport {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");

    String normalizeSearchKeyword(String keyword, int maxLength) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        String normalized = keyword.trim();
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength);
    }

    ArticleWhereClause buildArticleWhereClause(NewsArticleSearchCriteria criteria) {
        List<Object> params = new ArrayList<>();
        List<String> conditions = new ArrayList<>();
        if (StringUtils.hasText(criteria.categoryCode()) && !"all".equals(criteria.categoryCode())) {
            conditions.add("category_code = ?");
            params.add(criteria.categoryCode());
        }
        if (criteria.fromDate() != null) {
            conditions.add("published_at >= ?");
            params.add(criteria.fromDate().atStartOfDay(SEOUL_ZONE).toInstant());
        }
        if (criteria.toDate() != null) {
            conditions.add("published_at < ?");
            params.add(criteria.toDate().plusDays(1).atStartOfDay(SEOUL_ZONE).toInstant());
        }
        if (StringUtils.hasText(criteria.keyword())) {
            String keywordPattern = "%" + escapeLikePattern(criteria.keyword()) + "%";
            conditions.add("(title LIKE ? ESCAPE '!' OR description LIKE ? ESCAPE '!')");
            params.add(keywordPattern);
            params.add(keywordPattern);
        }

        if (conditions.isEmpty()) {
            return new ArticleWhereClause("", params);
        }

        return new ArticleWhereClause("WHERE " + String.join(" AND ", conditions), params);
    }

    NewsService.NewsArticle mapArticle(ResultSet rs) throws SQLException {
        return new NewsService.NewsArticle(
            rs.getString("category_code"),
            rs.getString("category_name"),
            rs.getString("query_text"),
            rs.getString("title"),
            rs.getString("description"),
            rs.getString("origin_link"),
            rs.getString("link"),
            rs.getString("publisher"),
            rs.getTimestamp("published_at") == null ? null : rs.getTimestamp("published_at").toInstant(),
            rs.getString("ai_summary"),
            rs.getString("market_sentiment"),
            rs.getTimestamp("fetched_at").toInstant(),
            rs.getString("image_url")
        );
    }

    private String escapeLikePattern(String value) {
        return value
            .replace("!", "!!")
            .replace("%", "!%")
            .replace("_", "!_");
    }

    record ArticleWhereClause(String sql, List<Object> params) {
    }
}
