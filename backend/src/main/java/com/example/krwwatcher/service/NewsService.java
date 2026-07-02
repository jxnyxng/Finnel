package com.example.krwwatcher.service;

import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.net.URISyntaxException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

import com.example.krwwatcher.external.NaverNewsClient;
import com.example.krwwatcher.external.NewsImageClient;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.HtmlUtils;

@Service
public class NewsService {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final int LATEST_DISPLAY_COUNT = 100;
    private static final int BACKFILL_DISPLAY_COUNT = 100;
    private static final int NAVER_MAX_START = 1000;
    private static final int NEWS_RETENTION_YEARS = 5;
    private static final int NEWS_PAGE_SIZE = 10;
    private static final int MIN_BACKFILL_ARTICLES = 250;

    private static final List<NewsCategory> CATEGORIES = List.of(
        new NewsCategory("fx", "환율", "원달러 환율"),
        new NewsCategory("market", "외환시장", "외환시장"),
        new NewsCategory("rate", "금리·거시", "한국은행 기준금리"),
        new NewsCategory("fomc", "미국 연준", "미국 연준 FOMC"),
        new NewsCategory("policy", "국내 정책", "외환당국 환율")
    );

    private final NaverNewsClient naverNewsClient;
    private final NewsImageClient newsImageClient;
    private final JdbcTemplate jdbcTemplate;
    private final AtomicBoolean syncRunning = new AtomicBoolean(false);

    public NewsService(NaverNewsClient naverNewsClient, NewsImageClient newsImageClient, JdbcTemplate jdbcTemplate) {
        this.naverNewsClient = naverNewsClient;
        this.newsImageClient = newsImageClient;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(cron = "${app.sync.market-data.news-cron}", zone = "${app.sync.market-data.zone}")
    public void scheduledSync() {
        syncLatestNews();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void syncOnStartupIfStale() {
        normalizeStoredNewsArticles();
        deleteDuplicateNewsArticles();
        hydrateMissingLatestImages();

        if (!naverNewsClient.isConfigured()) {
            return;
        }

        if (hasNewsFetchedToday() && hasMinimumBackfillArticles()) {
            return;
        }

        syncNews();
    }

    @Transactional
    public NewsSyncResult syncNews() {
        return runSync("backfill", true);
    }

    @Transactional
    public NewsSyncResult syncLatestNews() {
        return runSync("latest", false);
    }

    public NewsSyncResult runSync(String mode, boolean backfill) {
        if (!naverNewsClient.isConfigured()) {
            return new NewsSyncResult("SKIPPED_NOT_CONFIGURED", "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET 설정이 필요합니다.", 0, Instant.now());
        }

        if (!syncRunning.compareAndSet(false, true)) {
            return new NewsSyncResult("SKIPPED_RUNNING", "뉴스 수집이 이미 진행 중입니다.", 0, Instant.now());
        }

        int rows = 0;
        try {
            Instant cutoff = LocalDate.now(SEOUL_ZONE)
                .minusYears(NEWS_RETENTION_YEARS)
                .atStartOfDay(SEOUL_ZONE)
                .toInstant();
            pruneNewsBefore(cutoff);
            normalizeStoredNewsArticles();
            deleteDuplicateNewsArticles();
            for (NewsCategory category : CATEGORIES) {
                rows += backfill ? syncCategoryBackfill(category, cutoff) : syncCategoryLatest(category);
            }
            normalizeStoredNewsArticles();
            deleteDuplicateNewsArticles();
            hydrateMissingLatestImages();
        } catch (RestClientResponseException exception) {
            return new NewsSyncResult(
                "NAVER_API_ERROR",
                "네이버 뉴스 API HTTP " + exception.getStatusCode().value() + ": " + cleanText(exception.getResponseBodyAsString()),
                rows,
                Instant.now()
            );
        } finally {
            syncRunning.set(false);
        }

        return new NewsSyncResult("SUCCESS", "mode=" + mode + ", news=" + rows, rows, Instant.now());
    }

    public NewsResponse latest(String categoryCode, int page, int pageSize) {
        int normalizedPage = Math.max(1, page);
        int normalizedPageSize = Math.max(1, Math.min(pageSize, NEWS_PAGE_SIZE));
        int offset = (normalizedPage - 1) * normalizedPageSize;
        List<NewsArticle> articles;
        int totalCount;
        if (StringUtils.hasText(categoryCode) && !"all".equals(categoryCode)) {
            totalCount = countArticles(categoryCode);
            articles = jdbcTemplate.query(
                """
                    SELECT n.category_code, n.category_name, n.query_text, n.title, n.description, n.origin_link, n.link, n.publisher, n.published_at, n.ai_summary, n.market_sentiment, n.image_url, n.fetched_at
                    FROM news_articles n
                    INNER JOIN (
                        SELECT MAX(id) AS id
                        FROM news_articles
                        WHERE category_code = ?
                        GROUP BY COALESCE(dedupe_key, article_key)
                    ) latest ON latest.id = n.id
                    ORDER BY n.published_at DESC, n.id DESC
                    LIMIT ? OFFSET ?
                    """,
                (rs, rowNum) -> mapArticle(rs),
                categoryCode,
                normalizedPageSize,
                offset
            );
        } else {
            totalCount = countArticles(null);
            articles = jdbcTemplate.query(
                """
                    SELECT n.category_code, n.category_name, n.query_text, n.title, n.description, n.origin_link, n.link, n.publisher, n.published_at, n.ai_summary, n.market_sentiment, n.image_url, n.fetched_at
                    FROM news_articles n
                    INNER JOIN (
                        SELECT MAX(id) AS id
                        FROM news_articles
                        GROUP BY COALESCE(dedupe_key, article_key)
                    ) latest ON latest.id = n.id
                    ORDER BY n.published_at DESC, n.id DESC
                    LIMIT ? OFFSET ?
                    """,
                (rs, rowNum) -> mapArticle(rs),
                normalizedPageSize,
                offset
            );
        }

        int totalPages = totalCount == 0 ? 0 : (int) Math.ceil((double) totalCount / normalizedPageSize);
        return new NewsResponse(naverNewsClient.isConfigured(), CATEGORIES, articles, normalizedPage, normalizedPageSize, totalCount, totalPages);
    }

    private int syncCategoryLatest(NewsCategory category) {
        return naverNewsClient.search(category.query(), LATEST_DISPLAY_COUNT, 1, "date").stream()
            .mapToInt(item -> upsertArticle(category, item, false))
            .sum();
    }

    private int syncCategoryBackfill(NewsCategory category, Instant cutoff) {
        int rows = 0;
        for (int start = 1; start <= NAVER_MAX_START; start += BACKFILL_DISPLAY_COUNT) {
            List<NaverNewsClient.NaverNewsItem> items = naverNewsClient.search(category.query(), BACKFILL_DISPLAY_COUNT, start, "date");
            if (items.isEmpty()) {
                break;
            }

            boolean reachedCutoff = false;
            for (NaverNewsClient.NaverNewsItem item : items) {
                Instant publishedAt = naverNewsClient.parsePublishedAt(item.pubDate());
                if (publishedAt != null && publishedAt.isBefore(cutoff)) {
                    reachedCutoff = true;
                    continue;
                }

                rows += upsertArticle(category, item, false);
            }

            if (reachedCutoff || items.size() < BACKFILL_DISPLAY_COUNT) {
                break;
            }
        }

        return rows;
    }

    private int upsertArticle(NewsCategory category, NaverNewsClient.NaverNewsItem item, boolean fetchImage) {
        String link = firstText(item.originLink(), item.link());
        if (!StringUtils.hasText(link)) {
            return 0;
        }

        String title = cleanText(item.title());
        if (!StringUtils.hasText(title)) {
            return 0;
        }

        String description = cleanText(item.description());
        String originLink = StringUtils.hasText(item.originLink()) ? item.originLink() : null;
        String canonicalUrl = canonicalizeUrl(link);
        Instant publishedAt = naverNewsClient.parsePublishedAt(item.pubDate());
        Instant fetchedAt = Instant.now();
        String dedupeKey = buildDedupeKey(canonicalUrl, title, publishedAt);
        String articleKey = sha256(dedupeKey);
        String imageUrl = fetchImage ? newsImageClient.fetchRepresentativeImage(link) : null;

        return jdbcTemplate.update(
            """
                INSERT INTO news_articles (article_key, dedupe_key, category_code, category_name, query_text, title, description, origin_link, link, canonical_url, publisher, published_at, image_url, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    dedupe_key = VALUES(dedupe_key),
                    category_code = VALUES(category_code),
                    category_name = VALUES(category_name),
                    query_text = VALUES(query_text),
                    title = VALUES(title),
                    description = VALUES(description),
                    origin_link = VALUES(origin_link),
                    link = VALUES(link),
                    canonical_url = VALUES(canonical_url),
                    publisher = VALUES(publisher),
                    published_at = VALUES(published_at),
                    image_url = COALESCE(VALUES(image_url), image_url),
                    fetched_at = VALUES(fetched_at)
                """,
            articleKey,
            dedupeKey,
            category.code(),
            category.name(),
            category.query(),
            title,
            description,
            originLink,
            link,
            canonicalUrl,
            null,
            publishedAt,
            imageUrl,
            fetchedAt
        );
    }

    private String firstText(String first, String second) {
        return StringUtils.hasText(first) ? first : second;
    }

    private boolean hasNewsFetchedToday() {
        Instant todayStart = LocalDate.now(SEOUL_ZONE).atStartOfDay(SEOUL_ZONE).toInstant();
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM news_articles
                WHERE fetched_at >= ?
                """,
            Integer.class,
            todayStart
        );
        return count != null && count > 0;
    }

    private boolean hasMinimumBackfillArticles() {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM news_articles
                WHERE published_at IS NULL
                   OR published_at >= ?
                """,
            Integer.class,
            LocalDate.now(SEOUL_ZONE).minusYears(NEWS_RETENTION_YEARS).atStartOfDay(SEOUL_ZONE).toInstant()
        );
        return count != null && count >= MIN_BACKFILL_ARTICLES;
    }

    private int countArticles(String categoryCode) {
        if (StringUtils.hasText(categoryCode)) {
            Integer count = jdbcTemplate.queryForObject(
                """
                    SELECT COUNT(*)
                    FROM (
                        SELECT 1
                        FROM news_articles
                        WHERE category_code = ?
                        GROUP BY COALESCE(dedupe_key, article_key)
                    ) deduped
                    """,
                Integer.class,
                categoryCode
            );
            return count == null ? 0 : count;
        }

        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM (
                    SELECT 1
                    FROM news_articles
                    GROUP BY COALESCE(dedupe_key, article_key)
                ) deduped
                """,
            Integer.class
        );
        return count == null ? 0 : count;
    }

    private void normalizeStoredNewsArticles() {
        List<StoredNewsArticle> articles = jdbcTemplate.query(
            """
                SELECT id, title, origin_link, link, published_at
                FROM news_articles
                WHERE dedupe_key IS NULL
                   OR canonical_url IS NULL
                """,
            (rs, rowNum) -> new StoredNewsArticle(
                rs.getLong("id"),
                rs.getString("title"),
                rs.getString("origin_link"),
                rs.getString("link"),
                rs.getTimestamp("published_at") == null ? null : rs.getTimestamp("published_at").toInstant()
            )
        );

        for (StoredNewsArticle article : articles) {
            String canonicalUrl = canonicalizeUrl(firstText(article.originLink(), article.link()));
            String dedupeKey = buildDedupeKey(canonicalUrl, article.title(), article.publishedAt());
            jdbcTemplate.update(
                """
                    UPDATE news_articles
                    SET dedupe_key = ?,
                        canonical_url = ?
                    WHERE id = ?
                    """,
                dedupeKey,
                canonicalUrl,
                article.id()
            );
        }
    }

    private void deleteDuplicateNewsArticles() {
        jdbcTemplate.update(
            """
                DELETE FROM news_articles
                WHERE dedupe_key IS NOT NULL
                  AND id NOT IN (
                      SELECT keep_id
                      FROM (
                          SELECT MAX(id) AS keep_id
                          FROM news_articles
                          WHERE dedupe_key IS NOT NULL
                          GROUP BY dedupe_key
                      ) keepers
                  )
                """
        );
    }

    private void hydrateMissingLatestImages() {
        List<StoredNewsArticle> articles = jdbcTemplate.query(
            """
                SELECT id, title, origin_link, link, published_at
                FROM news_articles
                WHERE image_url IS NULL
                ORDER BY published_at DESC, id DESC
                LIMIT 20
                """,
            (rs, rowNum) -> new StoredNewsArticle(
                rs.getLong("id"),
                rs.getString("title"),
                rs.getString("origin_link"),
                rs.getString("link"),
                rs.getTimestamp("published_at") == null ? null : rs.getTimestamp("published_at").toInstant()
            )
        );

        for (StoredNewsArticle article : articles) {
            String imageUrl = newsImageClient.fetchRepresentativeImage(firstText(article.originLink(), article.link()));
            if (StringUtils.hasText(imageUrl)) {
                jdbcTemplate.update(
                    """
                        UPDATE news_articles
                        SET image_url = ?
                        WHERE id = ?
                        """,
                    imageUrl,
                    article.id()
                );
            }
        }
    }

    private NewsArticle mapArticle(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new NewsArticle(
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

    private void pruneNewsBefore(Instant cutoff) {
        jdbcTemplate.update(
            """
                DELETE FROM news_articles
                WHERE published_at IS NOT NULL
                  AND published_at < ?
                """,
            cutoff
        );
    }

    private String buildDedupeKey(String canonicalUrl, String title, Instant publishedAt) {
        if (StringUtils.hasText(canonicalUrl)) {
            return sha256("url:" + canonicalUrl);
        }

        String publishedDate = publishedAt == null ? "" : LocalDate.ofInstant(publishedAt, SEOUL_ZONE).toString();
        return sha256("title:" + normalizeTitle(title) + ":" + publishedDate);
    }

    private String canonicalizeUrl(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        try {
            URI uri = new URI(value.trim());
            String scheme = uri.getScheme() == null ? "https" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost() == null ? null : uri.getHost().toLowerCase(Locale.ROOT);
            if (!StringUtils.hasText(host)) {
                return value.trim();
            }

            if (host.startsWith("www.")) {
                host = host.substring(4);
            }

            String path = uri.getRawPath();
            if (!StringUtils.hasText(path)) {
                path = "/";
            }
            while (path.length() > 1 && path.endsWith("/")) {
                path = path.substring(0, path.length() - 1);
            }

            return new URI(scheme, null, host, -1, path, null, null).toString();
        } catch (URISyntaxException | IllegalArgumentException exception) {
            return value.trim();
        }
    }

    private String normalizeTitle(String value) {
        String cleaned = cleanText(value);
        if (!StringUtils.hasText(cleaned)) {
            return "";
        }

        return cleaned.toLowerCase(Locale.ROOT)
            .replaceAll("\\[[^]]*]", " ")
            .replaceAll("\\([^)]*\\)", " ")
            .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", " ")
            .trim()
            .replaceAll("\\s+", " ");
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
        Instant fetchedAt,
        String imageUrl
    ) {
    }

    public record NewsResponse(
        boolean configured,
        List<NewsCategory> categories,
        List<NewsArticle> articles,
        int page,
        int pageSize,
        int totalCount,
        int totalPages
    ) {
    }

    public record NewsSyncResult(String status, String message, int rows, Instant syncedAt) {
    }

    private record StoredNewsArticle(long id, String title, String originLink, String link, Instant publishedAt) {
    }
}
