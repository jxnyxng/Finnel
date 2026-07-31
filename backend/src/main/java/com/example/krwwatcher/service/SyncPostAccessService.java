package com.example.krwwatcher.service;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import com.example.krwwatcher.config.SyncProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class SyncPostAccessService {

    private static final String ADMIN_TOKEN_HEADER = "X-Admin-Token";
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final List<String> BACKFILL_OPERATIONS = List.of(
        "DAILY_EXCHANGE_BACKFILL",
        "EXCHANGE_RATE_HISTORY_BACKFILL"
    );

    private final SyncProperties syncProperties;
    private final JdbcTemplate jdbcTemplate;

    public SyncPostAccessService(SyncProperties syncProperties, JdbcTemplate jdbcTemplate) {
        this.syncProperties = syncProperties;
        this.jdbcTemplate = jdbcTemplate;
    }

    public SyncPostCaller authorize(HttpServletRequest request, String operation) {
        String remoteIp = remoteIp(request);
        String token = requestToken(request);
        String configuredToken = syncProperties.marketData().postSecurity().adminToken();
        if (StringUtils.hasText(configuredToken) && constantTimeEquals(configuredToken, token)) {
            SyncPostCaller caller = new SyncPostCaller("admin-token", remoteIp);
            enforceBackfillRateLimit(request, operation, caller);
            return caller;
        }

        if (isAllowedInternalIp(remoteIp)) {
            SyncPostCaller caller = new SyncPostCaller("internal-network", remoteIp);
            enforceBackfillRateLimit(request, operation, caller);
            return caller;
        }

        int statusCode = StringUtils.hasText(token) ? FORBIDDEN.value() : UNAUTHORIZED.value();
        audit(request.getRequestURI(), operation, operation, null, remoteIp, false, statusCode, null, "sync POST requires admin token or allowed internal network");
        throw new ResponseStatusException(StringUtils.hasText(token) ? FORBIDDEN : UNAUTHORIZED, "Unauthorized sync POST");
    }

    public void auditSuccess(HttpServletRequest request, String operation, SyncPostCaller caller, MarketDataSyncService.SyncResult result) {
        audit(
            request.getRequestURI(),
            operation,
            result.trigger(),
            caller.caller(),
            caller.remoteIp(),
            true,
            200,
            result.status(),
            result.message()
        );
    }

    public void auditFailure(HttpServletRequest request, String operation, SyncPostCaller caller, RuntimeException exception) {
        audit(
            request.getRequestURI(),
            operation,
            operation,
            caller.caller(),
            caller.remoteIp(),
            true,
            500,
            exception.getClass().getSimpleName(),
            exception.getMessage()
        );
    }

    private void enforceBackfillRateLimit(HttpServletRequest request, String operation, SyncPostCaller caller) {
        if (!BACKFILL_OPERATIONS.contains(operation)) {
            return;
        }

        Duration cooldown = syncProperties.marketData().postSecurity().backfillRateLimitCooldown();
        if (cooldown == null || cooldown.isZero() || cooldown.isNegative()) {
            return;
        }

        Instant threshold = Instant.now().minus(cooldown);
        Integer recentCalls = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM sync_post_audit_logs
                WHERE operation = ?
                  AND authorized = TRUE
                  AND status_code = 200
                  AND requested_at >= ?
                """,
            Integer.class,
            operation,
            threshold
        );
        if (recentCalls != null && recentCalls > 0) {
            audit(request.getRequestURI(), operation, operation, caller.caller(), caller.remoteIp(), false, TOO_MANY_REQUESTS.value(), null, "manual backfill rate limit active");
            throw new ResponseStatusException(TOO_MANY_REQUESTS, "Manual backfill rate limit is active");
        }
    }

    private void audit(String endpoint, String operation, String triggerName, String caller, String remoteIp, boolean authorized, int statusCode, String resultStatus, String message) {
        jdbcTemplate.update(
            """
                INSERT INTO sync_post_audit_logs
                    (endpoint, operation, trigger_name, caller, remote_ip, authorized, status_code, result_status, message, requested_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
            endpoint == null ? "" : endpoint,
            operation,
            triggerName,
            caller,
            remoteIp,
            authorized,
            statusCode,
            resultStatus,
            truncate(message),
            Instant.now()
        );
    }

    private String requestToken(HttpServletRequest request) {
        String headerToken = request.getHeader(ADMIN_TOKEN_HEADER);
        if (StringUtils.hasText(headerToken)) {
            return headerToken.trim();
        }

        String authorization = request.getHeader(AUTHORIZATION_HEADER);
        if (StringUtils.hasText(authorization) && authorization.startsWith("Bearer ")) {
            return authorization.substring("Bearer ".length()).trim();
        }

        return null;
    }

    private String remoteIp(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    private boolean isAllowedInternalIp(String remoteIp) {
        String cidrs = syncProperties.marketData().postSecurity().allowedInternalCidrs();
        if (!StringUtils.hasText(cidrs) || !StringUtils.hasText(remoteIp)) {
            return false;
        }

        return Arrays.stream(cidrs.split(","))
            .map(String::trim)
            .filter(StringUtils::hasText)
            .anyMatch(cidr -> contains(cidr, remoteIp));
    }

    private boolean contains(String cidr, String remoteIp) {
        try {
            String[] parts = cidr.split("/");
            InetAddress networkAddress = InetAddress.getByName(parts[0]);
            InetAddress remoteAddress = InetAddress.getByName(remoteIp);
            byte[] network = networkAddress.getAddress();
            byte[] remote = remoteAddress.getAddress();
            if (network.length != remote.length) {
                return false;
            }

            int prefixLength = parts.length == 2 ? Integer.parseInt(parts[1]) : network.length * 8;
            if (prefixLength < 0 || prefixLength > network.length * 8) {
                return false;
            }

            int fullBytes = prefixLength / 8;
            int remainingBits = prefixLength % 8;
            for (int i = 0; i < fullBytes; i++) {
                if (network[i] != remote[i]) {
                    return false;
                }
            }

            if (remainingBits == 0) {
                return true;
            }

            int mask = 0xFF << (8 - remainingBits);
            return (network[fullBytes] & mask) == (remote[fullBytes] & mask);
        } catch (UnknownHostException | NumberFormatException | ArrayIndexOutOfBoundsException exception) {
            return false;
        }
    }

    private boolean constantTimeEquals(String expected, String actual) {
        if (!StringUtils.hasText(expected) || actual == null) {
            return false;
        }

        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    private String truncate(String message) {
        if (message == null || message.length() <= 1000) {
            return message;
        }

        return message.substring(0, 1000);
    }

    public record SyncPostCaller(String caller, String remoteIp) {
    }
}
