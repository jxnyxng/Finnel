package com.example.krwwatcher.health;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.example.krwwatcher.service.UsdKrwIntradaySession;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component("operational")
public class OperationalHealthIndicator implements HealthIndicator {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final Status DEGRADED = new Status("DEGRADED");
    private static final Duration USD_KRW_INTRADAY_STALE_AFTER = Duration.ofMinutes(10);
    private static final Duration CONTENT_STALE_AFTER = Duration.ofHours(1);
    private static final int CONSECUTIVE_FULL_SYNC_FAILURE_ALERT_THRESHOLD = 2;
    private static final String MARKET_DATA_SYNC_JOB = "MARKET_DATA_SYNC";
    private static final String INTRADAY_EXCHANGE_SYNC_JOB = "INTRADAY_EXCHANGE_SYNC";

    private final JdbcTemplate jdbcTemplate;
    private final ExternalApiProperties externalApiProperties;

    public OperationalHealthIndicator(JdbcTemplate jdbcTemplate, ExternalApiProperties externalApiProperties) {
        this.jdbcTemplate = jdbcTemplate;
        this.externalApiProperties = externalApiProperties;
    }

    @Override
    public Health health() {
        Map<String, Object> details = new LinkedHashMap<>();
        HealthStatus status = HealthStatus.UP;

        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            details.put("database", Map.of("status", "UP"));
        } catch (DataAccessException exception) {
            return Health.down(exception)
                .withDetail("database", Map.of("status", "DOWN", "message", exception.getClass().getSimpleName()))
                .build();
        }

        status = status.worst(checkCoreSync(details));
        status = status.worst(checkUsdKrwFreshness(details));
        status = status.worst(checkContentFreshness("news", "news_articles", details));
        status = status.worst(checkContentFreshness("governmentBriefings", "government_briefings", details));
        status = status.worst(checkExternalApiConfiguration(details));
        details.put("alertCriteria", alertCriteria());

        return switch (status) {
            case DOWN -> Health.down().withDetails(details).build();
            case DEGRADED -> Health.status(DEGRADED).withDetails(details).build();
            case UP -> Health.up().withDetails(details).build();
        };
    }

    private HealthStatus checkCoreSync(Map<String, Object> details) {
        LatestJob latestMarketSync = latestJob(MARKET_DATA_SYNC_JOB);
        Instant lastSuccessfulCoreSyncAt = latestSuccessfulJobEndedAt(MARKET_DATA_SYNC_JOB);
        int consecutiveFullSyncFailures = consecutiveFailures(MARKET_DATA_SYNC_JOB);

        Map<String, Object> coreSync = new LinkedHashMap<>();
        coreSync.put("jobName", MARKET_DATA_SYNC_JOB);
        coreSync.put("latestStatus", latestMarketSync == null ? null : latestMarketSync.status());
        coreSync.put("latestStartedAt", latestMarketSync == null ? null : latestMarketSync.startedAt());
        coreSync.put("latestEndedAt", latestMarketSync == null ? null : latestMarketSync.endedAt());
        coreSync.put("lastSuccessfulCoreSyncAt", lastSuccessfulCoreSyncAt);
        coreSync.put("consecutiveFullSyncFailures", consecutiveFullSyncFailures);
        coreSync.put("alertThreshold", CONSECUTIVE_FULL_SYNC_FAILURE_ALERT_THRESHOLD);
        details.put("coreSync", coreSync);

        if (consecutiveFullSyncFailures >= CONSECUTIVE_FULL_SYNC_FAILURE_ALERT_THRESHOLD) {
            coreSync.put("status", "DOWN");
            coreSync.put("reason", "full collection failed at least 2 consecutive times");
            return HealthStatus.DOWN;
        }
        if (lastSuccessfulCoreSyncAt == null) {
            coreSync.put("status", "DEGRADED");
            coreSync.put("reason", "no successful core sync has been recorded");
            return HealthStatus.DEGRADED;
        }
        if (latestMarketSync != null && isFailureStatus(latestMarketSync.status())) {
            coreSync.put("status", "DEGRADED");
            coreSync.put("reason", "latest core sync failed");
            return HealthStatus.DEGRADED;
        }

        coreSync.put("status", "UP");
        return HealthStatus.UP;
    }

    private HealthStatus checkUsdKrwFreshness(Map<String, Object> details) {
        String currencyPair = nullSafe(externalApiProperties.twelveData()).usdKrwSymbol();
        LocalDateTime latestObservedAt = latestUsdKrwObservedAt(currencyPair);
        LocalDateTime now = LocalDateTime.now(SEOUL_ZONE);
        boolean inTradingSession = UsdKrwIntradaySession.activeSessionStartDate(now) != null;

        Map<String, Object> freshness = new LinkedHashMap<>();
        freshness.put("currencyPair", currencyPair);
        freshness.put("latestObservedAt", latestObservedAt);
        freshness.put("inTradingSession", inTradingSession);
        freshness.put("staleAfter", USD_KRW_INTRADAY_STALE_AFTER.toString());
        freshness.put("latestSyncStatus", latestStatus(INTRADAY_EXCHANGE_SYNC_JOB));
        details.put("usdKrwFreshness", freshness);

        if (!inTradingSession) {
            freshness.put("status", "UP");
            freshness.put("reason", "outside active USD/KRW intraday session");
            return HealthStatus.UP;
        }
        if (latestObservedAt == null) {
            freshness.put("status", "DEGRADED");
            freshness.put("reason", "no intraday USD/KRW observation in storage");
            return HealthStatus.DEGRADED;
        }

        Duration lag = Duration.between(latestObservedAt, now);
        freshness.put("lagSeconds", lag.getSeconds());
        if (lag.compareTo(USD_KRW_INTRADAY_STALE_AFTER) > 0) {
            freshness.put("status", "DEGRADED");
            freshness.put("reason", "USD/KRW intraday data is delayed by more than 10 minutes during trading hours");
            return HealthStatus.DEGRADED;
        }

        freshness.put("status", "UP");
        return HealthStatus.UP;
    }

    private HealthStatus checkContentFreshness(String detailKey, String tableName, Map<String, Object> details) {
        Instant latestFetchedAt = latestFetchedAt(tableName);
        Instant now = Instant.now();

        Map<String, Object> freshness = new LinkedHashMap<>();
        freshness.put("latestFetchedAt", latestFetchedAt);
        freshness.put("staleAfter", CONTENT_STALE_AFTER.toString());
        details.put(detailKey, freshness);

        if (latestFetchedAt == null) {
            freshness.put("status", "DEGRADED");
            freshness.put("reason", "no successful content fetch has been recorded");
            return HealthStatus.DEGRADED;
        }

        Duration lag = Duration.between(latestFetchedAt, now);
        freshness.put("lagSeconds", lag.getSeconds());
        if (lag.compareTo(CONTENT_STALE_AFTER) > 0) {
            freshness.put("status", "DEGRADED");
            freshness.put("reason", "content fetch is older than 1 hour");
            return HealthStatus.DEGRADED;
        }

        freshness.put("status", "UP");
        return HealthStatus.UP;
    }

    private HealthStatus checkExternalApiConfiguration(Map<String, Object> details) {
        Map<String, Boolean> configured = new LinkedHashMap<>();
        configured.put("koreaexim", hasText(nullSafe(externalApiProperties.koreaexim()).apiKey()));
        configured.put("ecos", hasText(nullSafe(externalApiProperties.ecos()).apiKey()));
        configured.put("fred", hasText(nullSafe(externalApiProperties.fred()).apiKey()));
        configured.put("twelveData", hasText(nullSafe(externalApiProperties.twelveData()).apiKey()));
        configured.put("naver", hasText(nullSafe(externalApiProperties.naver()).clientId()) && hasText(nullSafe(externalApiProperties.naver()).clientSecret()));
        configured.put("openFiscal", hasText(nullSafe(externalApiProperties.openFiscal()).apiKey()));
        configured.put("policyBriefing", hasText(nullSafe(externalApiProperties.policyBriefing()).apiKey()));
        configured.put("kasi", hasText(nullSafe(externalApiProperties.kasi()).apiKey()));
        configured.put("bis", hasText(nullSafe(externalApiProperties.bis()).effectiveExchangeRatesBulkUrl()));

        List<String> missing = configured.entrySet().stream()
            .filter(entry -> !entry.getValue())
            .map(Map.Entry::getKey)
            .toList();

        Map<String, Object> apiConfiguration = new LinkedHashMap<>();
        apiConfiguration.put("configured", configured);
        apiConfiguration.put("missing", missing);
        details.put("externalApis", apiConfiguration);

        if (!missing.isEmpty()) {
            apiConfiguration.put("status", "DEGRADED");
            apiConfiguration.put("reason", "one or more external API settings are missing");
            return HealthStatus.DEGRADED;
        }

        apiConfiguration.put("status", "UP");
        return HealthStatus.UP;
    }

    private Map<String, Object> alertCriteria() {
        return Map.of(
            "usdKrwIntradayDelay", "DEGRADED when active-session USD/KRW latest observation lags more than 10 minutes",
            "fullCollectionFailures", "DOWN when MARKET_DATA_SYNC fails 2 consecutive times",
            "newsOrBriefingDelay", "DEGRADED when latest news or government briefing fetch is older than 1 hour"
        );
    }

    private LatestJob latestJob(String jobName) {
        return jdbcTemplate.query(
            """
                SELECT status, started_at, ended_at
                FROM batch_job_runs
                WHERE job_name = ?
                ORDER BY started_at DESC, id DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new LatestJob(
                rs.getString("status"),
                rs.getTimestamp("started_at").toInstant(),
                rs.getTimestamp("ended_at") == null ? null : rs.getTimestamp("ended_at").toInstant()
            ),
            jobName
        ).stream().findFirst().orElse(null);
    }

    private Instant latestSuccessfulJobEndedAt(String jobName) {
        return jdbcTemplate.query(
            """
                SELECT ended_at
                FROM batch_job_runs
                WHERE job_name = ?
                  AND status IN ('SUCCESS', 'DEGRADED')
                ORDER BY ended_at DESC, started_at DESC, id DESC
                LIMIT 1
                """,
            (rs, rowNum) -> rs.getTimestamp("ended_at") == null ? null : rs.getTimestamp("ended_at").toInstant(),
            jobName
        ).stream().findFirst().orElse(null);
    }

    private int consecutiveFailures(String jobName) {
        List<String> statuses = jdbcTemplate.query(
            """
                SELECT status
                FROM batch_job_runs
                WHERE job_name = ?
                ORDER BY started_at DESC, id DESC
                LIMIT ?
                """,
            (rs, rowNum) -> rs.getString("status"),
            jobName,
            CONSECUTIVE_FULL_SYNC_FAILURE_ALERT_THRESHOLD
        );
        if (statuses.size() < CONSECUTIVE_FULL_SYNC_FAILURE_ALERT_THRESHOLD) {
            return 0;
        }
        return statuses.stream().allMatch(this::isFailureStatus) ? statuses.size() : 0;
    }

    private String latestStatus(String jobName) {
        LatestJob latest = latestJob(jobName);
        return latest == null ? null : latest.status();
    }

    private boolean isFailureStatus(String status) {
        return "FAILED".equals(status) || "FAILED_CORE_SOURCE".equals(status);
    }

    private LocalDateTime latestUsdKrwObservedAt(String currencyPair) {
        if (!hasText(currencyPair)) {
            return null;
        }
        return jdbcTemplate.query(
            """
                SELECT MAX(observed_at)
                FROM intraday_exchange_rates
                WHERE currency_pair = ?
                """,
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toLocalDateTime(),
            currencyPair
        ).stream().findFirst().orElse(null);
    }

    private Instant latestFetchedAt(String tableName) {
        return jdbcTemplate.query(
            "SELECT MAX(fetched_at) FROM " + tableName,
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toInstant()
        ).stream().findFirst().orElse(null);
    }

    private boolean hasText(String value) {
        return StringUtils.hasText(value);
    }

    private ExternalApiProperties.Koreaexim nullSafe(ExternalApiProperties.Koreaexim value) {
        return value == null ? new ExternalApiProperties.Koreaexim(null, null) : value;
    }

    private ExternalApiProperties.Ecos nullSafe(ExternalApiProperties.Ecos value) {
        return value == null ? new ExternalApiProperties.Ecos(null, null, null, null, null, null) : value;
    }

    private ExternalApiProperties.Fred nullSafe(ExternalApiProperties.Fred value) {
        return value == null ? new ExternalApiProperties.Fred(null, null, null, null, null, null, null, null, null, null) : value;
    }

    private ExternalApiProperties.TwelveData nullSafe(ExternalApiProperties.TwelveData value) {
        return value == null ? new ExternalApiProperties.TwelveData(null, null, null, null, null) : value;
    }

    private ExternalApiProperties.Bis nullSafe(ExternalApiProperties.Bis value) {
        return value == null ? new ExternalApiProperties.Bis(null) : value;
    }

    private ExternalApiProperties.Naver nullSafe(ExternalApiProperties.Naver value) {
        return value == null ? new ExternalApiProperties.Naver(null, null, null) : value;
    }

    private ExternalApiProperties.OpenFiscal nullSafe(ExternalApiProperties.OpenFiscal value) {
        return value == null ? new ExternalApiProperties.OpenFiscal(null, null) : value;
    }

    private ExternalApiProperties.PolicyBriefing nullSafe(ExternalApiProperties.PolicyBriefing value) {
        return value == null ? new ExternalApiProperties.PolicyBriefing(null, null) : value;
    }

    private ExternalApiProperties.Kasi nullSafe(ExternalApiProperties.Kasi value) {
        return value == null ? new ExternalApiProperties.Kasi(null, null) : value;
    }

    private enum HealthStatus {
        UP,
        DEGRADED,
        DOWN;

        private HealthStatus worst(HealthStatus other) {
            return ordinal() >= other.ordinal() ? this : other;
        }
    }

    private record LatestJob(String status, Instant startedAt, Instant endedAt) {
    }
}
