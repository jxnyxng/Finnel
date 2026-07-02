package com.example.krwwatcher.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

import com.example.krwwatcher.external.NaverNewsClient;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.HtmlUtils;

@Service
public class NewsService {

    private static final List<NewsCategory> CATEGORIES = List.of(
        new NewsCategory("fx", "환율", "원달러 환율"),
        new NewsCategory("market", "외환시장", "외환시장"),
        new NewsCategory("rate", "금리·거시", "한국은행 기준금리"),
        new NewsCategory("fomc", "미국 연준", "미국 연준 FOMC"),
        new NewsCategory("policy", "국내 정책", "외환당국 환율")
    );

    private final NaverNewsClient naverNewsClient;
    private final JdbcTemplate jdbcTemplate;

    public NewsService(NaverNewsClient naverNewsClient, JdbcTemplate jdbcTemplate) {
        this.naverNewsClient = naverNewsClient;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(cron = "${app.sync.market-data.news-cron}", zone = "${app.sync.market-data.zone}")
    public void scheduledSync() {
        syncNews();
    }

    @Transactional
    public NewsSyncResult syncNews() {
        if (!naverNewsClient.isConfigured()) {
            return new NewsSyncResult("SKIPPED_NOT_CONFIGURED", "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET 설정이 필요합니다.", 0, Instant.now());
        }

        int rows = 0;
        try {
            for (NewsCategory category : CATEGORIES) {
                rows += syncCategory(category);
            }
        } catch (RestClientResponseException exception) {
            return new NewsSyncResult(
                "NAVER_API_ERROR",
                "네이버 뉴스 API HTTP " + exception.getStatusCode().value() + ": " + cleanText(exception.getResponseBodyAsString()),
                rows,
                Instant.now()
            );
        }

        return new NewsSyncResult("SUCCESS", "news=" + rows, rows, Instant.now());
    }

    public NewsResponse latest(String categoryCode, int limit) {
        int normalizedLimit = Math.max(1, Math.min(limit, 50));
        List<NewsArticle> articles;
        if (StringUtils.hasText(categoryCode) && !"all".equals(categoryCode)) {
            articles = jdbcTemplate.query(
                """
                    SELECT category_code, category_name, query_text, title, description, origin_link, link, publisher, published_at, ai_summary, market_sentiment, fetched_at
                    FROM news_articles
                    WHERE category_code = ?
                    ORDER BY published_at DESC, id DESC
                    LIMIT ?
                    """,
                (rs, rowNum) -> new NewsArticle(
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
                    rs.getTimestamp("fetched_at").toInstant()
                ),
                categoryCode,
                normalizedLimit
            );
        } else {
            articles = jdbcTemplate.query(
                """
                    SELECT category_code, category_name, query_text, title, description, origin_link, link, publisher, published_at, ai_summary, market_sentiment, fetched_at
                    FROM news_articles
                    ORDER BY published_at DESC, id DESC
                    LIMIT ?
                    """,
                (rs, rowNum) -> new NewsArticle(
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
                    rs.getTimestamp("fetched_at").toInstant()
                ),
                normalizedLimit
            );
        }

        return new NewsResponse(naverNewsClient.isConfigured(), CATEGORIES, articles);
    }

    private int syncCategory(NewsCategory category) {
        return naverNewsClient.search(category.query(), 20, "date").stream()
            .mapToInt(item -> upsertArticle(category, item))
            .sum();
    }

    private int upsertArticle(NewsCategory category, NaverNewsClient.NaverNewsItem item) {
        String link = firstText(item.link(), item.originLink());
        if (!StringUtils.hasText(link)) {
            return 0;
        }

        String articleKey = sha256(link);
        String title = cleanText(item.title());
        if (!StringUtils.hasText(title)) {
            return 0;
        }

        String description = cleanText(item.description());
        String originLink = StringUtils.hasText(item.originLink()) ? item.originLink() : null;
        Instant publishedAt = naverNewsClient.parsePublishedAt(item.pubDate());
        Instant fetchedAt = Instant.now();

        return jdbcTemplate.update(
            """
                INSERT INTO news_articles (article_key, category_code, category_name, query_text, title, description, origin_link, link, publisher, published_at, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    category_code = VALUES(category_code),
                    category_name = VALUES(category_name),
                    query_text = VALUES(query_text),
                    title = VALUES(title),
                    description = VALUES(description),
                    origin_link = VALUES(origin_link),
                    link = VALUES(link),
                    publisher = VALUES(publisher),
                    published_at = VALUES(published_at),
                    fetched_at = VALUES(fetched_at)
                """,
            articleKey,
            category.code(),
            category.name(),
            category.query(),
            title,
            description,
            originLink,
            link,
            null,
            publishedAt,
            fetchedAt
        );
    }

    private String firstText(String first, String second) {
        return StringUtils.hasText(first) ? first : second;
    }

    private String cleanText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        String withoutTags = value.replaceAll("<[^>]*>", "");
        return HtmlUtils.htmlUnescape(withoutTags).trim();
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    public record NewsCategory(String code, String name, String query) {
    }

    public record NewsArticle(
        String categoryCode,
        String categoryName,
        String queryText,
        String title,
        String description,
        String originLink,
        String link,
        String publisher,
        Instant publishedAt,
        String aiSummary,
        String marketSentiment,
        Instant fetchedAt
    ) {
    }

    public record NewsResponse(boolean configured, List<NewsCategory> categories, List<NewsArticle> articles) {
    }

    public record NewsSyncResult(String status, String message, int rows, Instant syncedAt) {
    }
}
