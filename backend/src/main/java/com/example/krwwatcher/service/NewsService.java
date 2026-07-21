package com.example.krwwatcher.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Duration;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import com.example.krwwatcher.external.NaverNewsClient;
import com.example.krwwatcher.service.news.NewsArticleMaintenance;
import com.example.krwwatcher.service.news.NewsArticleSearchCriteria;
import com.example.krwwatcher.service.news.NewsArticleText;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientResponseException;

@Service
public class NewsService {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final int LATEST_DISPLAY_COUNT = 100;
    private static final int BACKFILL_DISPLAY_COUNT = 100;
    private static final int NAVER_MAX_START = 1000;
    private static final int NEWS_RETENTION_YEARS = 5;
    private static final int NEWS_PAGE_SIZE = 10;
    private static final int MIN_BACKFILL_ARTICLES = 250;
    private static final Duration FRESHNESS_MAX_AGE = Duration.ofMinutes(60);

    private static final List<NewsCategory> CATEGORIES = List.of(
        new NewsCategory("fx", "환율", "원달러 환율"),
        new NewsCategory("market", "외환시장", "외환시장"),
        new NewsCategory("rate", "금리·거시", "한국은행 기준금리"),
        new NewsCategory("fomc", "미국 연준", "미국 연준 FOMC"),
        new NewsCategory("policy", "국내 정책", "외환당국 환율")
    );

    private final NaverNewsClient naverNewsClient;
    private final JdbcTemplate jdbcTemplate;
    private final NewsArticleMaintenance newsArticleMaintenance;
    private final NewsArticleText newsArticleText;
    private final AtomicBoolean syncRunning = new AtomicBoolean(false);

    public NewsService(
        NaverNewsClient naverNewsClient,
        JdbcTemplate jdbcTemplate,
        NewsArticleMaintenance newsArticleMaintenance,
        NewsArticleText newsArticleText
    ) {
        this.naverNewsClient = naverNewsClient;
        this.jdbcTemplate = jdbcTemplate;
        this.newsArticleMaintenance = newsArticleMaintenance;
        this.newsArticleText = newsArticleText;
    }

    @Scheduled(cron = "${app.sync.market-data.news-cron}", zone = "${app.sync.market-data.zone}")
    public void scheduledSync() {
        syncLatestNews();
    }

    @EventListener(ApplicationReadyEvent.class)
    @Async("startupSyncExecutor")
    public void syncOnStartupIfStale() {
        newsArticleMaintenance.normalizeStoredNewsArticles();
        newsArticleMaintenance.deleteDuplicateNewsArticles();
        newsArticleMaintenance.hydrateMissingLatestImages();

        if (!naverNewsClient.isConfigured()) {
            return;
        }

        if (hasMinimumBackfillArticles()) {
            syncLatestNews();
        } else {
            syncNews();
        }
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
            newsArticleMaintenance.normalizeStoredNewsArticles();
            newsArticleMaintenance.deleteDuplicateNewsArticles();
            for (NewsCategory category : CATEGORIES) {
                rows += backfill ? syncCategoryBackfill(category, cutoff) : syncCategoryLatest(category);
            }
            newsArticleMaintenance.normalizeStoredNewsArticles();
            newsArticleMaintenance.deleteDuplicateNewsArticles();
            newsArticleMaintenance.hydrateMissingLatestImages();
        } catch (RestClientResponseException exception) {
            return new NewsSyncResult(
                "NAVER_API_ERROR",
                "네이버 뉴스 API HTTP " + exception.getStatusCode().value() + ": " + newsArticleText.cleanText(exception.getResponseBodyAsString()),
                rows,
                Instant.now()
            );
        } finally {
            syncRunning.set(false);
        }

        return new NewsSyncResult("SUCCESS", "mode=" + mode + ", news=" + rows, rows, Instant.now());
    }

    public NewsResponse latest(String categoryCode, LocalDate fromDate, LocalDate toDate, String keyword, int page, int pageSize) {
        NewsArticleSearchCriteria criteria = new NewsArticleSearchCriteria(categoryCode, fromDate, toDate, keyword);
        int normalizedPage = Math.max(1, page);
        int normalizedPageSize = Math.max(1, Math.min(pageSize, NEWS_PAGE_SIZE));
        int offset = (normalizedPage - 1) * normalizedPageSize;
        int totalCount = countArticles(criteria);
        List<Object> params = new ArrayList<>();
        String whereClause = buildArticleWhereClause(criteria, params);
        String sql = """
            SELECT n.category_code, n.category_name, n.query_text, n.title, n.description, n.origin_link, n.link, n.publisher, n.published_at, n.ai_summary, n.market_sentiment, n.image_url, n.fetched_at
            FROM news_articles n
            INNER JOIN (
                SELECT MAX(id) AS id
                FROM news_articles
                %s
                GROUP BY COALESCE(dedupe_key, article_key)
            ) latest ON latest.id = n.id
            ORDER BY n.published_at DESC, n.id DESC
            LIMIT ? OFFSET ?
            """.formatted(whereClause);
        params.add(normalizedPageSize);
        params.add(offset);
        List<NewsArticle> articles = jdbcTemplate.query(sql, (rs, rowNum) -> mapArticle(rs), params.toArray());

        int totalPages = totalCount == 0 ? 0 : (int) Math.ceil((double) totalCount / normalizedPageSize);
        FreshnessInfo freshness = contentFreshness(findLatestNewsFetchedAt());
        return new NewsResponse(
            naverNewsClient.isConfigured(),
            CATEGORIES,
            articles,
            normalizedPage,
            normalizedPageSize,
            totalCount,
            totalPages,
            freshness.freshnessStatus(),
            freshness.staleReason(),
            freshness.expectedNextUpdateAt(),
            freshness.lastSuccessfulFetchedAt()
        );
    }

    public RelatedNewsResponse related(String topic, int limit) {
        int normalizedLimit = Math.max(1, Math.min(limit, 30));
        List<NewsArticle> candidates = jdbcTemplate.query(
            """
            SELECT n.category_code, n.category_name, n.query_text, n.title, n.description, n.origin_link, n.link, n.publisher, n.published_at, n.ai_summary, n.market_sentiment, n.image_url, n.fetched_at
            FROM news_articles n
            INNER JOIN (
                SELECT MAX(id) AS id
                FROM news_articles
                GROUP BY COALESCE(dedupe_key, article_key)
            ) latest ON latest.id = n.id
            ORDER BY n.published_at DESC, n.id DESC
            LIMIT 100
            """,
            (rs, rowNum) -> mapArticle(rs)
        );
        List<String> keywords = relatedKeywords(topic);
        List<NewsArticle> articles = candidates.stream()
            .sorted(Comparator
                .comparingInt((NewsArticle article) -> scoreRelatedArticle(article, keywords)).reversed()
                .thenComparing((NewsArticle article) -> StringUtils.hasText(article.imageUrl()), Comparator.reverseOrder())
                .thenComparing(NewsArticle::publishedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(NewsArticle::fetchedAt, Comparator.reverseOrder()))
            .limit(normalizedLimit)
            .toList();

        return new RelatedNewsResponse(naverNewsClient.isConfigured(), articles);
    }

    private List<String> relatedKeywords(String topic) {
        if ("indicators".equals(topic)) {
            return List.of("한국은행", "기준금리", "금리", "FOMC", "연준", "외환보유액", "경상수지", "무역수지", "물가", "재정", "CDS");
        }

        return List.of("원달러", "환율", "달러", "원화", "외환", "외환시장", "달러 인덱스", "연준", "FOMC");
    }

    private int scoreRelatedArticle(NewsArticle article, List<String> keywords) {
        String title = article.title() == null ? "" : article.title();
        String description = article.description() == null ? "" : article.description();
        String categoryName = article.categoryName() == null ? "" : article.categoryName();
        String queryText = article.queryText() == null ? "" : article.queryText();
        int score = 0;

        for (String keyword : keywords) {
            if (title.contains(keyword)) {
                score += 5;
            }
            if (description.contains(keyword)) {
                score += 2;
            }
            if (categoryName.contains(keyword) || queryText.contains(keyword)) {
                score += 3;
            }
        }

        if (StringUtils.hasText(article.imageUrl())) {
            score += 8;
        }

        return score;
    }

    private int syncCategoryLatest(NewsCategory category) {
        return naverNewsClient.search(category.query(), LATEST_DISPLAY_COUNT, 1, "date").stream()
            .mapToInt(item -> upsertArticle(category, item))
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

                rows += upsertArticle(category, item);
            }

            if (reachedCutoff || items.size() < BACKFILL_DISPLAY_COUNT) {
                break;
            }
        }

        return rows;
    }

    private int upsertArticle(NewsCategory category, NaverNewsClient.NaverNewsItem item) {
        String link = newsArticleText.firstText(item.originLink(), item.link());
        if (!StringUtils.hasText(link)) {
            return 0;
        }

        String title = newsArticleText.cleanText(item.title());
        if (!StringUtils.hasText(title)) {
            return 0;
        }

        String description = newsArticleText.cleanText(item.description());
        String originLink = StringUtils.hasText(item.originLink()) ? item.originLink() : null;
        String canonicalUrl = newsArticleText.canonicalizeUrl(link);
        Instant publishedAt = naverNewsClient.parsePublishedAt(item.pubDate());
        Instant fetchedAt = Instant.now();
        String dedupeKey = newsArticleText.buildDedupeKey(canonicalUrl, title, publishedAt);
        String articleKey = newsArticleText.sha256(dedupeKey == null ? link : dedupeKey);

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
            null,
            fetchedAt
        );
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

    private int countArticles(NewsArticleSearchCriteria criteria) {
        List<Object> params = new ArrayList<>();
        String whereClause = buildArticleWhereClause(criteria, params);
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM (
                    SELECT 1
                    FROM news_articles
                    %s
                    GROUP BY COALESCE(dedupe_key, article_key)
                ) deduped
                """.formatted(whereClause),
            Integer.class,
            params.toArray()
        );
        return count == null ? 0 : count;
    }

    private Instant findLatestNewsFetchedAt() {
        return jdbcTemplate.query(
            """
                SELECT MAX(fetched_at)
                FROM news_articles
                """,
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toInstant()
        ).stream().findFirst().orElse(null);
    }

    private String buildArticleWhereClause(NewsArticleSearchCriteria criteria, List<Object> params) {
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
            String keywordPattern = "%" + criteria.keyword().trim() + "%";
            conditions.add("(title LIKE ? OR description LIKE ?)");
            params.add(keywordPattern);
            params.add(keywordPattern);
        }

        if (conditions.isEmpty()) {
            return "";
        }

        return "WHERE " + String.join(" AND ", conditions);
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

    private FreshnessInfo contentFreshness(Instant lastSuccessfulFetchedAt) {
        if (lastSuccessfulFetchedAt == null) {
            return new FreshnessInfo("MISSING", "저장된 최신 수집값이 없습니다.", null, null);
        }

        Instant expectedNextUpdateAt = lastSuccessfulFetchedAt.plus(FRESHNESS_MAX_AGE);
        if (Instant.now().isAfter(expectedNextUpdateAt)) {
            return new FreshnessInfo("STALE", "뉴스 수집이 60분 이상 지연되었습니다.", expectedNextUpdateAt, lastSuccessfulFetchedAt);
        }

        return new FreshnessInfo("FRESH", null, expectedNextUpdateAt, lastSuccessfulFetchedAt);
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
        int totalPages,
        String freshnessStatus,
        String staleReason,
        Instant expectedNextUpdateAt,
        Instant lastSuccessfulFetchedAt
    ) {
    }

    public record RelatedNewsResponse(boolean configured, List<NewsArticle> articles) {
    }

    public record NewsSyncResult(String status, String message, int rows, Instant syncedAt) {
    }

    private record FreshnessInfo(
        String freshnessStatus,
        String staleReason,
        Instant expectedNextUpdateAt,
        Instant lastSuccessfulFetchedAt
    ) {
    }

}
