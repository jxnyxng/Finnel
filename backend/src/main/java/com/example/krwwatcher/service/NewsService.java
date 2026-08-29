package com.example.krwwatcher.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import com.example.krwwatcher.config.SyncProperties;
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

    private static final String JOB_NAME = "NEWS_SYNC";
    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final int LATEST_DISPLAY_COUNT = 100;
    private static final int BACKFILL_DISPLAY_COUNT = 100;
    private static final int NAVER_MAX_START = 1000;
    private static final int NEWS_RETENTION_YEARS = 5;
    private static final int NEWS_PAGE_SIZE = 10;
    private static final int MIN_BACKFILL_ARTICLES = 250;
    private static final int MAX_SEARCH_KEYWORD_LENGTH = 80;
    private static final int RELATED_CANDIDATE_LIMIT = 3000;
    private static final int RELATED_BANNER_DISPLAY_COUNT = 9;
    private static final List<NewsCategory> CATEGORIES = List.of(
        new NewsCategory("fx", "환율", "원달러 환율", 0),
        new NewsCategory("market", "외환시장", "외환시장", 0),
        new NewsCategory("rate", "금리·거시", "한국은행 기준금리", 0),
        new NewsCategory("fomc", "미국 연준", "미국 연준 FOMC", 0),
        new NewsCategory("policy", "국내 정책", "외환당국 환율", 0)
    );

    private final NaverNewsClient naverNewsClient;
    private final SyncProperties syncProperties;
    private final JdbcTemplate jdbcTemplate;
    private final NewsArticleMaintenance newsArticleMaintenance;
    private final NewsArticleText newsArticleText;
    private final NewsRelatedArticleSelector relatedArticleSelector;
    private final NewsArticleQuerySupport articleQuerySupport = new NewsArticleQuerySupport();
    private final NewsFreshnessPolicy freshnessPolicy = new NewsFreshnessPolicy();
    private final AtomicBoolean syncRunning = new AtomicBoolean(false);

    public NewsService(
        NaverNewsClient naverNewsClient,
        SyncProperties syncProperties,
        JdbcTemplate jdbcTemplate,
        NewsArticleMaintenance newsArticleMaintenance,
        NewsArticleText newsArticleText
    ) {
        this.naverNewsClient = naverNewsClient;
        this.syncProperties = syncProperties;
        this.jdbcTemplate = jdbcTemplate;
        this.newsArticleMaintenance = newsArticleMaintenance;
        this.newsArticleText = newsArticleText;
        this.relatedArticleSelector = new NewsRelatedArticleSelector(newsArticleText);
    }

    @Scheduled(cron = "${app.sync.market-data.news-cron}", zone = "${app.sync.market-data.zone}")
    public void scheduledSync() {
        if (!isContentSyncEnabled()) {
            return;
        }

        syncLatestNews();
    }

    @EventListener(ApplicationReadyEvent.class)
    @Async("startupSyncExecutor")
    public void syncOnStartupIfStale() {
        markInterruptedRunningJob(Instant.now());
        if (!isContentSyncEnabled()) {
            return;
        }

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
        if (!isContentSyncEnabled()) {
            return new NewsSyncResult("SKIPPED_DISABLED", "콘텐츠 수집이 비활성화되어 있습니다.", 0, Instant.now());
        }

        if (!naverNewsClient.isConfigured()) {
            return new NewsSyncResult("SKIPPED_NOT_CONFIGURED", "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET 설정이 필요합니다.", 0, Instant.now());
        }

        if (!syncRunning.compareAndSet(false, true)) {
            return new NewsSyncResult("SKIPPED_RUNNING", "뉴스 수집이 이미 진행 중입니다.", 0, Instant.now());
        }

        Instant startedAt = Instant.now();
        Long jobId = startJob(startedAt, mode);
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
            Instant endedAt = Instant.now();
            String message = "네이버 뉴스 API HTTP " + exception.getStatusCode().value() + ": " + newsArticleText.cleanText(exception.getResponseBodyAsString());
            finishJob(jobId, "FAILED", endedAt, message);
            return new NewsSyncResult(
                "NAVER_API_ERROR",
                message,
                rows,
                endedAt
            );
        } catch (RuntimeException exception) {
            Instant endedAt = Instant.now();
            String message = "뉴스 수집 실패: " + exception.getClass().getSimpleName();
            finishJob(jobId, "FAILED", endedAt, message);
            return new NewsSyncResult(
                "NEWS_SYNC_ERROR",
                message,
                rows,
                endedAt
            );
        } finally {
            syncRunning.set(false);
        }

        Instant syncedAt = Instant.now();
        String message = "mode=" + mode + ", news=" + rows;
        finishJob(jobId, "SUCCESS", syncedAt, message);
        return new NewsSyncResult("SUCCESS", message, rows, syncedAt);
    }

    private boolean isContentSyncEnabled() {
        return syncProperties == null || syncProperties.content() == null || syncProperties.content().enabled();
    }

    public NewsResponse latest(String categoryCode, LocalDate fromDate, LocalDate toDate, String keyword, int page, int pageSize) {
        String normalizedKeyword = normalizeSearchKeyword(keyword);
        NewsArticleSearchCriteria criteria = new NewsArticleSearchCriteria(categoryCode, fromDate, toDate, normalizedKeyword);
        int normalizedPage = Math.max(1, page);
        int normalizedPageSize = Math.max(1, Math.min(pageSize, NEWS_PAGE_SIZE));
        int offset = (normalizedPage - 1) * normalizedPageSize;
        int totalCount = countArticles(criteria);
        NewsArticleQuerySupport.ArticleWhereClause whereClause = articleQuerySupport.buildArticleWhereClause(criteria);
        List<Object> params = new ArrayList<>(whereClause.params());
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
            """.formatted(whereClause.sql());
        params.add(normalizedPageSize);
        params.add(offset);
        List<NewsArticle> articles = jdbcTemplate.query(sql, (rs, rowNum) -> mapArticle(rs), params.toArray());

        int totalPages = totalCount == 0 ? 0 : (int) Math.ceil((double) totalCount / normalizedPageSize);
        Instant lastSuccessfulFetchedAt = latestSuccessfulFetchOrSyncAt();
        NewsLatestSyncAttempt latestSyncAttempt = latestSyncAttempt();
        NewsFreshnessInfo freshness = contentFreshness(lastSuccessfulFetchedAt, latestSyncAttempt);
        return new NewsResponse(
            naverNewsClient.isConfigured(),
            categories(fromDate, toDate, normalizedKeyword),
            articles,
            normalizedPage,
            normalizedPageSize,
            totalCount,
            totalPages,
            freshness.freshnessStatus(),
            freshness.staleReason(),
            freshness.expectedNextUpdateAt(),
            freshness.lastSuccessfulFetchedAt(),
            latestSyncAttempt == null ? null : latestSyncAttempt.status(),
            latestSyncAttempt == null ? null : latestSyncAttempt.startedAt(),
            latestSyncAttempt == null ? null : latestSyncAttempt.endedAt()
        );
    }

    public RelatedNewsResponse related(String topic, int limit) {
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
            LIMIT ?
            """,
            (rs, rowNum) -> mapArticle(rs),
            RELATED_CANDIDATE_LIMIT
        );
        List<NewsArticle> articles = relatedArticleSelector.select(candidates, topic, RELATED_BANNER_DISPLAY_COUNT);

        return new RelatedNewsResponse(naverNewsClient.isConfigured(), articles);
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
        NewsArticleQuerySupport.ArticleWhereClause whereClause = articleQuerySupport.buildArticleWhereClause(criteria);
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM (
                    SELECT 1
                    FROM news_articles
                    %s
                    GROUP BY COALESCE(dedupe_key, article_key)
                ) deduped
                """.formatted(whereClause.sql()),
            Integer.class,
            whereClause.params().toArray()
        );
        return count == null ? 0 : count;
    }

    private List<NewsCategory> categories(LocalDate fromDate, LocalDate toDate, String keyword) {
        NewsArticleSearchCriteria criteria = new NewsArticleSearchCriteria("all", fromDate, toDate, keyword);
        NewsArticleQuerySupport.ArticleWhereClause whereClause = articleQuerySupport.buildArticleWhereClause(criteria);
        java.util.Map<String, Integer> countByCode = jdbcTemplate.query(
            """
                SELECT n.category_code, COUNT(*) AS article_count
                FROM news_articles n
                INNER JOIN (
                    SELECT MAX(id) AS id
                    FROM news_articles
                    %s
                    GROUP BY COALESCE(dedupe_key, article_key)
                ) latest ON latest.id = n.id
                GROUP BY n.category_code
                """.formatted(whereClause.sql()),
            rs -> {
                java.util.Map<String, Integer> counts = new java.util.HashMap<>();
                while (rs.next()) {
                    counts.put(rs.getString("category_code"), rs.getInt("article_count"));
                }
                return counts;
            },
            whereClause.params().toArray()
        );

        return CATEGORIES.stream()
            .map(category -> new NewsCategory(
                category.code(),
                category.name(),
                category.query(),
                countByCode.getOrDefault(category.code(), 0)
            ))
            .toList();
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

    private Instant latestSuccessfulFetchOrSyncAt() {
        Instant latestFetchedAt = findLatestNewsFetchedAt();
        Instant latestSyncEndedAt = latestSuccessfulJobEndedAt();
        if (latestFetchedAt == null) {
            return latestSyncEndedAt;
        }
        if (latestSyncEndedAt == null) {
            return latestFetchedAt;
        }
        return latestFetchedAt.isAfter(latestSyncEndedAt) ? latestFetchedAt : latestSyncEndedAt;
    }

    private Long startJob(Instant startedAt, String mode) {
        jdbcTemplate.update(
            "INSERT INTO batch_job_runs (job_name, status, started_at, message) VALUES (?, ?, ?, ?)",
            JOB_NAME,
            "RUNNING",
            startedAt,
            mode + " sync started"
        );
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    private void finishJob(Long jobId, String status, Instant endedAt, String message) {
        jdbcTemplate.update(
            "UPDATE batch_job_runs SET status = ?, ended_at = ?, message = ? WHERE id = ?",
            status,
            endedAt,
            truncateMessage(message),
            jobId
        );
    }

    private void markInterruptedRunningJob(Instant endedAt) {
        jdbcTemplate.update(
            """
                UPDATE batch_job_runs
                SET status = 'FAILED',
                    ended_at = ?,
                    message = CASE
                        WHEN message IS NULL OR message = '' THEN ?
                        ELSE CONCAT(message, ', ', ?)
                    END
                WHERE job_name = ?
                  AND status = 'RUNNING'
                """,
            endedAt,
            "interrupted=backend-restarted",
            "interrupted=backend-restarted",
            JOB_NAME
        );
    }

    private String truncateMessage(String message) {
        if (message == null || message.length() <= 1000) {
            return message;
        }
        return message.substring(0, 1000);
    }

    private Instant latestSuccessfulJobEndedAt() {
        return jdbcTemplate.query(
            """
                SELECT ended_at
                FROM batch_job_runs
                WHERE job_name = ?
                  AND status = 'SUCCESS'
                ORDER BY ended_at DESC, started_at DESC, id DESC
                LIMIT 1
                """,
            (rs, rowNum) -> rs.getTimestamp("ended_at") == null ? null : rs.getTimestamp("ended_at").toInstant(),
            JOB_NAME
        ).stream().filter(java.util.Objects::nonNull).findFirst().orElse(null);
    }

    private NewsLatestSyncAttempt latestSyncAttempt() {
        return jdbcTemplate.query(
            """
                SELECT status, started_at, ended_at
                FROM batch_job_runs
                WHERE job_name = ?
                ORDER BY started_at DESC, id DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new NewsLatestSyncAttempt(
                rs.getString("status"),
                rs.getTimestamp("started_at") == null ? null : rs.getTimestamp("started_at").toInstant(),
                rs.getTimestamp("ended_at") == null ? null : rs.getTimestamp("ended_at").toInstant()
            ),
            JOB_NAME
        ).stream().findFirst().orElse(null);
    }

    private NewsArticle mapArticle(java.sql.ResultSet rs) throws java.sql.SQLException {
        return articleQuerySupport.mapArticle(rs);
    }

    private String normalizeSearchKeyword(String keyword) {
        return articleQuerySupport.normalizeSearchKeyword(keyword, MAX_SEARCH_KEYWORD_LENGTH);
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

    private NewsFreshnessInfo contentFreshness(Instant lastSuccessfulFetchedAt, NewsLatestSyncAttempt latestSyncAttempt) {
        return freshnessPolicy.contentFreshness(lastSuccessfulFetchedAt, latestSyncAttempt, Instant.now());
    }

    public record NewsCategory(String code, String name, String query, int articleCount) {
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
        Instant lastSuccessfulFetchedAt,
        String latestSyncStatus,
        Instant latestSyncStartedAt,
        Instant latestSyncEndedAt
    ) {
    }

    public record RelatedNewsResponse(boolean configured, List<NewsArticle> articles) {
    }

    public record NewsSyncResult(String status, String message, int rows, Instant syncedAt) {
    }

}
