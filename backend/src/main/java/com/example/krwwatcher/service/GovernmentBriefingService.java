package com.example.krwwatcher.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;

import com.example.krwwatcher.config.SyncProperties;
import com.example.krwwatcher.external.PolicyBriefingClient;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class GovernmentBriefingService {

    private static final String JOB_NAME = "GOVERNMENT_BRIEFING_SYNC";
    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final int MAX_PAGE_SIZE = 30;
    private static final int MAX_BACKFILL_MONTHS = 36;
    private static final int MAX_SEARCH_KEYWORD_LENGTH = 80;
    private static final Duration FRESHNESS_MAX_AGE = Duration.ofMinutes(60);

    private final PolicyBriefingClient policyBriefingClient;
    private final SyncProperties syncProperties;
    private final JdbcTemplate jdbcTemplate;
    private final AtomicBoolean syncRunning = new AtomicBoolean(false);
    private final GovernmentBriefingResponseBuilder responseBuilder = new GovernmentBriefingResponseBuilder();
    private final GovernmentBriefingFilterPolicy filterPolicy = new GovernmentBriefingFilterPolicy();
    private final GovernmentBriefingSyncCoordinator syncCoordinator = new GovernmentBriefingSyncCoordinator(syncRunning);
    private final GovernmentBriefingArticleMapper articleMapper = new GovernmentBriefingArticleMapper();

    public GovernmentBriefingService(PolicyBriefingClient policyBriefingClient, SyncProperties syncProperties, JdbcTemplate jdbcTemplate) {
        this.policyBriefingClient = policyBriefingClient;
        this.syncProperties = syncProperties;
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Async("startupSyncExecutor")
    public void syncOnStartupIfStale() {
        markInterruptedRunningJob(Instant.now());
        if (!isContentSyncEnabled()) {
            return;
        }

        if (!policyBriefingClient.isConfigured()) {
            return;
        }

        syncLatest();
    }

    @Scheduled(cron = "${app.sync.market-data.news-cron}", zone = "${app.sync.market-data.zone}")
    public void scheduledSync() {
        if (!isContentSyncEnabled()) {
            return;
        }

        syncLatest();
    }

    @Transactional
    public GovernmentBriefingSyncResult syncLatest() {
        return syncCoordinator.run(
            "latest",
            isContentSyncEnabled(),
            () -> policyBriefingClient.isConfigured(),
            progress -> {
                for (PolicyBriefingClient.PolicyBriefingPayload payload : policyBriefingClient.fetchLatest(1, 30)) {
                    progress.addRows(upsertRelevantBriefing(payload));
                }
            },
            progress -> "briefings=" + progress.rows(),
            (exception, progress) -> "정책브리핑 API 호출 실패: " + exception.getClass().getSimpleName(),
            this::startJob,
            this::finishJob
        );
    }

    @Transactional
    public GovernmentBriefingSyncResult backfill(int months) {
        int normalizedMonths = Math.max(1, Math.min(months, MAX_BACKFILL_MONTHS));
        return syncCoordinator.run(
            "backfill months=" + normalizedMonths,
            isContentSyncEnabled(),
            () -> policyBriefingClient.isConfigured(),
            progress -> {
                LocalDate endDate = LocalDate.now(SEOUL_ZONE);
                LocalDate cursor = endDate.minusMonths(normalizedMonths).plusDays(1);
                while (!cursor.isAfter(endDate)) {
                    LocalDate windowEnd = cursor.plusDays(2).isAfter(endDate) ? endDate : cursor.plusDays(2);
                    List<PolicyBriefingClient.PolicyBriefingPayload> payloads = policyBriefingClient.fetchRange(cursor, windowEnd);
                    progress.addFetched(payloads.size());
                    for (PolicyBriefingClient.PolicyBriefingPayload payload : payloads) {
                        progress.addRows(upsertRelevantBriefing(payload));
                    }
                    progress.incrementCalls();
                    cursor = windowEnd.plusDays(1);
                }
            },
            progress -> "briefings=" + progress.rows() + ", fetched=" + progress.fetched() + ", calls=" + progress.calls(),
            (exception, progress) -> "정책브리핑 API 호출 실패: " + exception.getClass().getSimpleName()
                + ", calls=" + progress.calls() + ", fetched=" + progress.fetched() + ", rows=" + progress.rows(),
            this::startJob,
            this::finishJob
        );
    }

    private boolean isContentSyncEnabled() {
        return syncProperties == null || syncProperties.content() == null || syncProperties.content().enabled();
    }

    public GovernmentBriefingResponse latest(String category, LocalDate fromDate, LocalDate toDate, int page, int pageSize, String keyword) {
        GovernmentBriefingPageRequest pageRequest = responseBuilder.normalizePage(page, pageSize, MAX_PAGE_SIZE);
        List<Object> params = new ArrayList<>();
        String whereClause = buildWhereClause(category, fromDate, toDate, keyword, params);
        Integer totalCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM government_briefings " + whereClause,
            Integer.class,
            params.toArray()
        );

        List<Object> queryParams = new ArrayList<>(params);
        queryParams.add(pageRequest.pageSize());
        queryParams.add(pageRequest.offset());
        List<GovernmentBriefingArticle> articles = jdbcTemplate.query(
            """
                SELECT title, subtitle, body, ministry, category, published_at, thumbnail_url, image_url, original_url, kogl_type, fetched_at
                FROM government_briefings
                %s
                ORDER BY published_at DESC, id DESC
                LIMIT ? OFFSET ?
                """.formatted(whereClause),
            (rs, rowNum) -> articleMapper.mapArticle(rs),
            queryParams.toArray()
        );
        int count = totalCount == null ? 0 : totalCount;
        Instant lastSuccessfulFetchedAt = latestSuccessfulFetchOrSyncAt();
        LatestSyncAttempt latestSyncAttempt = latestSyncAttempt();
        FreshnessInfo freshness = contentFreshness(lastSuccessfulFetchedAt, latestSyncAttempt);
        return responseBuilder.build(
            policyBriefingClient.isConfigured(),
            briefingCategories(fromDate, toDate, keyword),
            articles,
            pageRequest,
            count,
            freshness,
            latestSyncAttempt
        );
    }

    private String buildWhereClause(String category, LocalDate fromDate, LocalDate toDate, String keyword, List<Object> params) {
        List<String> conditions = new ArrayList<>();
        if (StringUtils.hasText(category) && filterPolicy.relevantCategoryCodes().contains(category)) {
            conditions.add("category = ?");
            params.add(category);
        } else {
            conditions.add("category IN (%s)".formatted(String.join(", ", filterPolicy.relevantCategoryCodes().stream().map(ignored -> "?").toList())));
            params.addAll(filterPolicy.relevantCategoryCodes());
        }
        if (fromDate != null) {
            conditions.add("published_at >= ?");
            params.add(fromDate.atStartOfDay(SEOUL_ZONE).toInstant());
        }
        if (toDate != null) {
            conditions.add("published_at < ?");
            params.add(toDate.plusDays(1).atStartOfDay(SEOUL_ZONE).toInstant());
        }
        if (StringUtils.hasText(keyword)) {
            String pattern = "%" + escapeLikePattern(normalizeSearchKeyword(keyword)) + "%";
            conditions.add("(title LIKE ? ESCAPE '!' OR subtitle LIKE ? ESCAPE '!' OR body LIKE ? ESCAPE '!')");
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
        }
        conditions.add("body IS NOT NULL");
        conditions.add("CHAR_LENGTH(body) >= ?");
        params.add(filterPolicy.minBodyLength());

        if (conditions.isEmpty()) {
            return "";
        }

        return "WHERE " + String.join(" AND ", conditions);
    }

    private List<GovernmentBriefingCategory> briefingCategories(LocalDate fromDate, LocalDate toDate, String keyword) {
        Map<String, String> labelByCode = new LinkedHashMap<>();
        filterPolicy.categoryRules().forEach(rule -> labelByCode.put(rule.code(), rule.label()));
        List<Object> params = new ArrayList<>();
        String whereClause = buildWhereClause("all", fromDate, toDate, keyword, params);
        Map<String, Integer> countByCode = jdbcTemplate.query(
            """
                SELECT category, COUNT(*) AS article_count
                FROM government_briefings
                %s
                GROUP BY category
                ORDER BY article_count DESC, category ASC
                """.formatted(whereClause),
            rs -> {
                Map<String, Integer> counts = new LinkedHashMap<>();
                while (rs.next()) {
                    counts.put(rs.getString("category"), rs.getInt("article_count"));
                }
                return counts;
            },
            params.toArray()
        );

        return filterPolicy.categoryRules().stream()
            .map(rule -> new GovernmentBriefingCategory(
                rule.code(),
                labelByCode.getOrDefault(rule.code(), rule.code()),
                countByCode.getOrDefault(rule.code(), 0)
            ))
            .toList();
    }

    private String normalizeSearchKeyword(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        String normalized = keyword.trim();
        if (normalized.length() <= MAX_SEARCH_KEYWORD_LENGTH) {
            return normalized;
        }
        return normalized.substring(0, MAX_SEARCH_KEYWORD_LENGTH);
    }

    private String escapeLikePattern(String value) {
        return value
            .replace("!", "!!")
            .replace("%", "!%")
            .replace("_", "!_");
    }

    private int upsertRelevantBriefing(PolicyBriefingClient.PolicyBriefingPayload payload) {
        if (!filterPolicy.isRelevant(payload)) {
            return 0;
        }

        GovernmentBriefingFilterPolicy.RelevanceResult relevance = filterPolicy.relevance(payload);
        return upsertBriefing(payload, relevance.categoryCode());
    }

    private int upsertBriefing(PolicyBriefingClient.PolicyBriefingPayload payload, String category) {
        String title = truncate(payload.title(), 500);
        String originalUrl = truncate(payload.originalUrl(), 1000);
        String keySource = StringUtils.hasText(originalUrl)
            ? originalUrl
            : title + "|" + (payload.publishedAt() == null ? "" : payload.publishedAt().toString());
        return jdbcTemplate.update(
            """
                INSERT INTO government_briefings (briefing_key, title, subtitle, body, ministry, category, published_at, thumbnail_url, image_url, original_url, kogl_type, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    title = VALUES(title),
                    subtitle = VALUES(subtitle),
                    body = VALUES(body),
                    ministry = VALUES(ministry),
                    category = VALUES(category),
                    published_at = VALUES(published_at),
                    thumbnail_url = VALUES(thumbnail_url),
                    image_url = VALUES(image_url),
                    original_url = VALUES(original_url),
                    kogl_type = VALUES(kogl_type),
                    fetched_at = VALUES(fetched_at)
                """,
            sha256(keySource),
            title,
            truncate(payload.subtitle(), 1000),
            payload.body(),
            truncate(payload.ministry(), 120),
            truncate(category, 80),
            payload.publishedAt(),
            truncate(payload.thumbnailUrl(), 1000),
            truncate(payload.imageUrl(), 1000),
            originalUrl,
            truncate(payload.koglType(), 40),
            Instant.now()
        );
    }

    private boolean hasBriefingsFetchedToday() {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM government_briefings
                WHERE fetched_at >= ?
                    AND category IN (%s)
                """.formatted(String.join(", ", filterPolicy.relevantCategoryCodes().stream().map(ignored -> "?").toList())),
            Integer.class,
            relevantCategoryQueryParams(LocalDate.now(SEOUL_ZONE).atStartOfDay(SEOUL_ZONE).toInstant())
        );
        return count != null && count > 0;
    }

    private Instant findLatestBriefingFetchedAt() {
        return jdbcTemplate.query(
            """
                SELECT MAX(fetched_at)
                FROM government_briefings
                WHERE category IN (%s)
                  AND body IS NOT NULL
                  AND CHAR_LENGTH(body) >= ?
                """.formatted(String.join(", ", filterPolicy.relevantCategoryCodes().stream().map(ignored -> "?").toList())),
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toInstant(),
            relevantCategoryQualityParams()
        ).stream()
            .filter(Objects::nonNull)
            .findFirst()
            .orElse(null);
    }

    private Instant latestSuccessfulFetchOrSyncAt() {
        Instant latestFetchedAt = findLatestBriefingFetchedAt();
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
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    private LatestSyncAttempt latestSyncAttempt() {
        return jdbcTemplate.query(
            """
                SELECT status, started_at, ended_at
                FROM batch_job_runs
                WHERE job_name = ?
                ORDER BY started_at DESC, id DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new LatestSyncAttempt(
                rs.getString("status"),
                rs.getTimestamp("started_at") == null ? null : rs.getTimestamp("started_at").toInstant(),
                rs.getTimestamp("ended_at") == null ? null : rs.getTimestamp("ended_at").toInstant()
            ),
            JOB_NAME
        ).stream().findFirst().orElse(null);
    }

    private Object[] relevantCategoryQueryParams(Object firstParam) {
        List<Object> params = new ArrayList<>();
        params.add(firstParam);
        params.addAll(filterPolicy.relevantCategoryCodes());
        return params.toArray();
    }

    private Object[] relevantCategoryQualityParams() {
        List<Object> params = new ArrayList<>(filterPolicy.relevantCategoryCodes());
        params.add(filterPolicy.minBodyLength());
        return params.toArray();
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash government briefing key", exception);
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private FreshnessInfo contentFreshness(Instant lastSuccessfulFetchedAt, LatestSyncAttempt latestSyncAttempt) {
        if (latestSyncAttempt != null && isFailedSyncStatus(latestSyncAttempt.status())) {
            return new FreshnessInfo("STALE", "마지막 정부 정책 업데이트 시도가 실패했습니다.", latestSyncAttempt.endedAt(), lastSuccessfulFetchedAt);
        }

        if (lastSuccessfulFetchedAt == null) {
            return new FreshnessInfo("MISSING", "저장된 최신 수집값이 없습니다.", null, null);
        }

        Instant expectedNextUpdateAt = lastSuccessfulFetchedAt.plus(FRESHNESS_MAX_AGE);
        if (Instant.now().isAfter(expectedNextUpdateAt)) {
            return new FreshnessInfo("STALE", "정부 브리핑 수집이 60분 이상 지연되었습니다.", expectedNextUpdateAt, lastSuccessfulFetchedAt);
        }

        return new FreshnessInfo("FRESH", null, expectedNextUpdateAt, lastSuccessfulFetchedAt);
    }

    private boolean isFailedSyncStatus(String status) {
        return status != null && !"SUCCESS".equals(status) && !"RUNNING".equals(status);
    }

    public record GovernmentBriefingCategory(String code, String name, int articleCount) {
    }

    public record GovernmentBriefingArticle(
        String title,
        String subtitle,
        String body,
        String ministry,
        String category,
        Instant publishedAt,
        String thumbnailUrl,
        String imageUrl,
        String originalUrl,
        String koglType,
        Instant fetchedAt
    ) {
    }

    public record GovernmentBriefingResponse(
        boolean configured,
        List<GovernmentBriefingCategory> categories,
        List<GovernmentBriefingArticle> articles,
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

    public record GovernmentBriefingSyncResult(String status, String message, int rows, Instant syncedAt) {
    }

    record FreshnessInfo(
        String freshnessStatus,
        String staleReason,
        Instant expectedNextUpdateAt,
        Instant lastSuccessfulFetchedAt
    ) {
    }

    record LatestSyncAttempt(
        String status,
        Instant startedAt,
        Instant endedAt
    ) {
    }
}
