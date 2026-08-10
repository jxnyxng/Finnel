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
import java.util.Locale;
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
    private static final int MIN_RELEVANCE_SCORE = 4;
    private static final int MAX_BACKFILL_MONTHS = 36;
    private static final List<BriefingCategoryRule> CATEGORY_RULES = List.of(
        new BriefingCategoryRule("monetary", "통화정책", List.of("기준금리", "금리", "통화정책", "한국은행", "금융통화위원회", "금통위", "유동성", "통화량", "M2")),
        new BriefingCategoryRule("fiscal", "재정정책", List.of("재정", "국가채무", "국채", "예산", "세수", "기획재정부", "관리재정수지", "재정수지", "정책금융")),
        new BriefingCategoryRule("fx", "외환·금융시장", List.of("환율", "외환", "원화", "달러", "자본시장", "금융시장", "외국인", "채권", "주식시장")),
        new BriefingCategoryRule("trade", "무역·수급", List.of("수출", "수입", "무역수지", "경상수지", "관세", "통상", "공급망", "원자재")),
        new BriefingCategoryRule("inflation", "물가·민생", List.of("물가", "소비자물가", "생산자물가", "유가", "에너지", "인플레이션"))
    );
    private static final List<String> RELEVANT_CATEGORY_CODES = CATEGORY_RULES.stream()
        .map(BriefingCategoryRule::code)
        .toList();
    private static final int MIN_BODY_LENGTH = 300;
    private static final Duration FRESHNESS_MAX_AGE = Duration.ofMinutes(60);

    private final PolicyBriefingClient policyBriefingClient;
    private final SyncProperties syncProperties;
    private final JdbcTemplate jdbcTemplate;
    private final AtomicBoolean syncRunning = new AtomicBoolean(false);

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
        if (!isContentSyncEnabled()) {
            return new GovernmentBriefingSyncResult("SKIPPED_DISABLED", "콘텐츠 수집이 비활성화되어 있습니다.", 0, Instant.now());
        }

        if (!policyBriefingClient.isConfigured()) {
            return new GovernmentBriefingSyncResult("SKIPPED_NOT_CONFIGURED", "POLICY_BRIEFING_API_KEY 설정이 필요합니다.", 0, Instant.now());
        }

        if (!syncRunning.compareAndSet(false, true)) {
            return new GovernmentBriefingSyncResult("SKIPPED_RUNNING", "정부 브리핑 수집이 이미 진행 중입니다.", 0, Instant.now());
        }

        Instant startedAt = Instant.now();
        Long jobId = startJob(startedAt, "latest");
        int rows = 0;
        try {
            for (PolicyBriefingClient.PolicyBriefingPayload payload : policyBriefingClient.fetchLatest(1, 30)) {
                rows += upsertRelevantBriefing(payload);
            }
        } catch (RuntimeException exception) {
            Instant endedAt = Instant.now();
            String message = "정책브리핑 API 호출 실패: " + exception.getClass().getSimpleName();
            finishJob(jobId, "FAILED", endedAt, message);
            return new GovernmentBriefingSyncResult(
                "POLICY_BRIEFING_API_ERROR",
                message,
                rows,
                endedAt
            );
        } finally {
            syncRunning.set(false);
        }

        Instant syncedAt = Instant.now();
        String message = "briefings=" + rows;
        finishJob(jobId, "SUCCESS", syncedAt, message);
        return new GovernmentBriefingSyncResult("SUCCESS", message, rows, syncedAt);
    }

    @Transactional
    public GovernmentBriefingSyncResult backfill(int months) {
        if (!isContentSyncEnabled()) {
            return new GovernmentBriefingSyncResult("SKIPPED_DISABLED", "콘텐츠 수집이 비활성화되어 있습니다.", 0, Instant.now());
        }

        if (!policyBriefingClient.isConfigured()) {
            return new GovernmentBriefingSyncResult("SKIPPED_NOT_CONFIGURED", "POLICY_BRIEFING_API_KEY 설정이 필요합니다.", 0, Instant.now());
        }

        if (!syncRunning.compareAndSet(false, true)) {
            return new GovernmentBriefingSyncResult("SKIPPED_RUNNING", "정부 브리핑 수집이 이미 진행 중입니다.", 0, Instant.now());
        }

        int normalizedMonths = Math.max(1, Math.min(months, MAX_BACKFILL_MONTHS));
        Instant startedAt = Instant.now();
        Long jobId = startJob(startedAt, "backfill months=" + normalizedMonths);
        LocalDate endDate = LocalDate.now(SEOUL_ZONE);
        LocalDate cursor = endDate.minusMonths(normalizedMonths).plusDays(1);
        int fetched = 0;
        int rows = 0;
        int calls = 0;
        try {
            while (!cursor.isAfter(endDate)) {
                LocalDate windowEnd = cursor.plusDays(2).isAfter(endDate) ? endDate : cursor.plusDays(2);
                List<PolicyBriefingClient.PolicyBriefingPayload> payloads = policyBriefingClient.fetchRange(cursor, windowEnd);
                fetched += payloads.size();
                for (PolicyBriefingClient.PolicyBriefingPayload payload : payloads) {
                    rows += upsertRelevantBriefing(payload);
                }
                calls++;
                cursor = windowEnd.plusDays(1);
            }
        } catch (RuntimeException exception) {
            Instant endedAt = Instant.now();
            String message = "정책브리핑 API 호출 실패: " + exception.getClass().getSimpleName() + ", calls=" + calls + ", fetched=" + fetched + ", rows=" + rows;
            finishJob(jobId, "FAILED", endedAt, message);
            return new GovernmentBriefingSyncResult(
                "POLICY_BRIEFING_API_ERROR",
                message,
                rows,
                endedAt
            );
        } finally {
            syncRunning.set(false);
        }

        Instant syncedAt = Instant.now();
        String message = "briefings=" + rows + ", fetched=" + fetched + ", calls=" + calls;
        finishJob(jobId, "SUCCESS", syncedAt, message);
        return new GovernmentBriefingSyncResult("SUCCESS", message, rows, syncedAt);
    }

    private boolean isContentSyncEnabled() {
        return syncProperties == null || syncProperties.content() == null || syncProperties.content().enabled();
    }

    public GovernmentBriefingResponse latest(String category, LocalDate fromDate, LocalDate toDate, int page, int pageSize, String keyword) {
        int normalizedPage = Math.max(1, page);
        int normalizedPageSize = Math.max(1, Math.min(pageSize, MAX_PAGE_SIZE));
        int offset = (normalizedPage - 1) * normalizedPageSize;
        List<Object> params = new ArrayList<>();
        String whereClause = buildWhereClause(category, fromDate, toDate, keyword, params);
        Integer totalCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM government_briefings " + whereClause,
            Integer.class,
            params.toArray()
        );

        List<Object> queryParams = new ArrayList<>(params);
        queryParams.add(normalizedPageSize);
        queryParams.add(offset);
        List<GovernmentBriefingArticle> articles = jdbcTemplate.query(
            """
                SELECT title, subtitle, body, ministry, category, published_at, thumbnail_url, image_url, original_url, kogl_type, fetched_at
                FROM government_briefings
                %s
                ORDER BY published_at DESC, id DESC
                LIMIT ? OFFSET ?
                """.formatted(whereClause),
            (rs, rowNum) -> new GovernmentBriefingArticle(
                rs.getString("title"),
                rs.getString("subtitle"),
                rs.getString("body"),
                rs.getString("ministry"),
                rs.getString("category"),
                rs.getTimestamp("published_at") == null ? null : rs.getTimestamp("published_at").toInstant(),
                rs.getString("thumbnail_url"),
                rs.getString("image_url"),
                rs.getString("original_url"),
                rs.getString("kogl_type"),
                rs.getTimestamp("fetched_at").toInstant()
            ),
            queryParams.toArray()
        );
        int count = totalCount == null ? 0 : totalCount;
        int totalPages = count == 0 ? 0 : (int) Math.ceil((double) count / normalizedPageSize);
        Instant lastSuccessfulFetchedAt = latestSuccessfulFetchOrSyncAt();
        LatestSyncAttempt latestSyncAttempt = latestSyncAttempt();
        FreshnessInfo freshness = contentFreshness(lastSuccessfulFetchedAt, latestSyncAttempt);
        return new GovernmentBriefingResponse(
            policyBriefingClient.isConfigured(),
            briefingCategories(fromDate, toDate, keyword),
            articles,
            normalizedPage,
            normalizedPageSize,
            count,
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

    private String buildWhereClause(String category, LocalDate fromDate, LocalDate toDate, String keyword, List<Object> params) {
        List<String> conditions = new ArrayList<>();
        if (StringUtils.hasText(category) && RELEVANT_CATEGORY_CODES.contains(category)) {
            conditions.add("category = ?");
            params.add(category);
        } else {
            conditions.add("category IN (%s)".formatted(String.join(", ", RELEVANT_CATEGORY_CODES.stream().map(ignored -> "?").toList())));
            params.addAll(RELEVANT_CATEGORY_CODES);
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
            String pattern = "%" + keyword.trim() + "%";
            conditions.add("(title LIKE ? OR subtitle LIKE ? OR body LIKE ?)");
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
        }
        conditions.add("body IS NOT NULL");
        conditions.add("CHAR_LENGTH(body) >= ?");
        params.add(MIN_BODY_LENGTH);

        if (conditions.isEmpty()) {
            return "";
        }

        return "WHERE " + String.join(" AND ", conditions);
    }

    private List<GovernmentBriefingCategory> briefingCategories(LocalDate fromDate, LocalDate toDate, String keyword) {
        Map<String, String> labelByCode = new LinkedHashMap<>();
        CATEGORY_RULES.forEach(rule -> labelByCode.put(rule.code(), rule.label()));
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

        return CATEGORY_RULES.stream()
            .map(rule -> new GovernmentBriefingCategory(
                rule.code(),
                labelByCode.getOrDefault(rule.code(), rule.code()),
                countByCode.getOrDefault(rule.code(), 0)
            ))
            .toList();
    }

    private int upsertRelevantBriefing(PolicyBriefingClient.PolicyBriefingPayload payload) {
        if (isLowQualityBriefing(payload)) {
            return 0;
        }

        RelevanceResult relevance = relevance(payload);
        if (relevance.score() < MIN_RELEVANCE_SCORE) {
            return 0;
        }

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

    private RelevanceResult relevance(PolicyBriefingClient.PolicyBriefingPayload payload) {
        String text = String.join(" ",
            nullToEmpty(payload.title()),
            nullToEmpty(payload.subtitle()),
            nullToEmpty(payload.body()),
            nullToEmpty(payload.ministry())
        ).toLowerCase(Locale.ROOT);
        int bestScore = 0;
        String bestCategory = null;
        for (BriefingCategoryRule rule : CATEGORY_RULES) {
            int score = 0;
            for (String keyword : rule.keywords()) {
                String normalizedKeyword = keyword.toLowerCase(Locale.ROOT);
                if (text.contains(normalizedKeyword)) {
                    score += keyword.length() >= 4 ? 3 : 2;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestCategory = rule.code();
            }
        }

        return new RelevanceResult(bestScore, bestCategory == null ? "policy" : bestCategory);
    }

    private boolean isLowQualityBriefing(PolicyBriefingClient.PolicyBriefingPayload payload) {
        String body = payload.body();
        return !StringUtils.hasText(body)
            || body.length() < MIN_BODY_LENGTH;
    }

    private boolean hasBriefingsFetchedToday() {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM government_briefings
                WHERE fetched_at >= ?
                    AND category IN (%s)
                """.formatted(String.join(", ", RELEVANT_CATEGORY_CODES.stream().map(ignored -> "?").toList())),
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
                """.formatted(String.join(", ", RELEVANT_CATEGORY_CODES.stream().map(ignored -> "?").toList())),
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
        params.addAll(RELEVANT_CATEGORY_CODES);
        return params.toArray();
    }

    private Object[] relevantCategoryQualityParams() {
        List<Object> params = new ArrayList<>(RELEVANT_CATEGORY_CODES);
        params.add(MIN_BODY_LENGTH);
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

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
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

    private record BriefingCategoryRule(String code, String label, List<String> keywords) {
    }

    private record RelevanceResult(int score, String categoryCode) {
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

    private record FreshnessInfo(
        String freshnessStatus,
        String staleReason,
        Instant expectedNextUpdateAt,
        Instant lastSuccessfulFetchedAt
    ) {
    }

    private record LatestSyncAttempt(
        String status,
        Instant startedAt,
        Instant endedAt
    ) {
    }
}
