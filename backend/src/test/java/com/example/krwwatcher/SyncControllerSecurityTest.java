package com.example.krwwatcher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import javax.sql.DataSource;

import com.example.krwwatcher.config.SyncProperties;
import com.example.krwwatcher.service.MarketDataSyncService;
import com.example.krwwatcher.service.SyncPostAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class SyncControllerSecurityTest {

    private JdbcTemplate jdbcTemplate;
    private MarketDataSyncService marketDataSyncService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
        jdbcTemplate.execute("""
            CREATE TABLE sync_post_audit_logs (
                id BIGINT NOT NULL AUTO_INCREMENT,
                endpoint VARCHAR(200) NOT NULL,
                operation VARCHAR(100) NOT NULL,
                trigger_name VARCHAR(100) NULL,
                caller VARCHAR(100) NULL,
                remote_ip VARCHAR(45) NULL,
                authorized BOOLEAN NOT NULL,
                status_code INT NOT NULL,
                result_status VARCHAR(50) NULL,
                message VARCHAR(1000) NULL,
                requested_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id)
            )
            """);
        marketDataSyncService = org.mockito.Mockito.mock(MarketDataSyncService.class);
        SyncPostAccessService accessService = new SyncPostAccessService(syncProperties(), jdbcTemplate);
        mockMvc = MockMvcBuilders
            .standaloneSetup(new SyncController(marketDataSyncService, accessService))
            .addPlaceholderValue("app.cors.allowed-origins", "http://localhost:5173")
            .build();
    }

    @Test
    void unauthenticatedSyncPostIsBlockedAndAudited() throws Exception {
        mockMvc.perform(post("/api/v1/sync/market-data").with(request -> {
                request.setRemoteAddr("203.0.113.10");
                return request;
            }))
            .andExpect(status().isUnauthorized());

        verifyNoInteractions(marketDataSyncService);
        String audit = jdbcTemplate.queryForObject(
            """
                SELECT CONCAT(operation, '|', trigger_name, '|', authorized, '|', status_code, '|', remote_ip)
                FROM sync_post_audit_logs
                """,
            String.class
        );
        assertThat(audit).isEqualTo("MARKET_DATA_SYNC|MARKET_DATA_SYNC|FALSE|401|203.0.113.10");
    }

    @Test
    void syncPostRunsOnlyWithAllowedTokenAndWritesAuditLog() throws Exception {
        when(marketDataSyncService.requestManualSync()).thenReturn(syncResult("SUCCESS", "MANUAL"));

        mockMvc.perform(post("/api/v1/sync/market-data")
                .header("X-Admin-Token", "secret-token")
                .with(request -> {
                    request.setRemoteAddr("203.0.113.10");
                    return request;
                }))
            .andExpect(status().isOk());

        verify(marketDataSyncService).requestManualSync();
        String audit = jdbcTemplate.queryForObject(
            """
                SELECT CONCAT(operation, '|', trigger_name, '|', caller, '|', authorized, '|', status_code, '|', result_status)
                FROM sync_post_audit_logs
                """,
            String.class
        );
        assertThat(audit).isEqualTo("MARKET_DATA_SYNC|MANUAL|admin-token|TRUE|200|SUCCESS");
    }

    @Test
    void manualBackfillPostHasSeparateRateLimit() throws Exception {
        when(marketDataSyncService.requestDailyBackfill()).thenReturn(syncResult("SUCCESS", "DAILY_BACKFILL"));

        mockMvc.perform(post("/api/v1/sync/daily-exchange/backfill")
                .header("Authorization", "Bearer secret-token")
                .with(request -> {
                    request.setRemoteAddr("203.0.113.10");
                    return request;
                }))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/sync/daily-exchange/backfill")
                .header("Authorization", "Bearer secret-token")
                .with(request -> {
                    request.setRemoteAddr("203.0.113.10");
                    return request;
                }))
            .andExpect(status().isTooManyRequests());

        verify(marketDataSyncService).requestDailyBackfill();
        Integer auditRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sync_post_audit_logs", Integer.class);
        assertThat(auditRows).isEqualTo(2);
    }

    @Test
    void spoofedForwardedForHeaderDoesNotSatisfyInternalNetworkAllowList() throws Exception {
        SyncPostAccessService accessService = new SyncPostAccessService(syncProperties("10.0.0.0/8"), jdbcTemplate);
        mockMvc = MockMvcBuilders
            .standaloneSetup(new SyncController(marketDataSyncService, accessService))
            .addPlaceholderValue("app.cors.allowed-origins", "http://localhost:5173")
            .build();

        mockMvc.perform(post("/api/v1/sync/market-data")
                .header("X-Forwarded-For", "10.1.2.3")
                .with(request -> {
                    request.setRemoteAddr("203.0.113.10");
                    return request;
                }))
            .andExpect(status().isUnauthorized());

        verifyNoInteractions(marketDataSyncService);
        String remoteIp = jdbcTemplate.queryForObject(
            "SELECT remote_ip FROM sync_post_audit_logs",
            String.class
        );
        assertThat(remoteIp).isEqualTo("203.0.113.10");
    }

    private MarketDataSyncService.SyncResult syncResult(String status, String trigger) {
        return new MarketDataSyncService.SyncResult(
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            status,
            "test",
            trigger,
            Instant.parse("2026-07-21T00:00:00Z"),
            null,
            0
        );
    }

    private SyncProperties syncProperties() {
        return syncProperties("");
    }

    private SyncProperties syncProperties(String allowedInternalCidrs) {
        return new SyncProperties(new SyncProperties.Content(true), new SyncProperties.MarketData(
            true,
            Duration.ofMinutes(15),
            "",
            "Asia/Seoul",
            Duration.ofMinutes(5),
            "",
            Duration.ofHours(1),
            3,
            Duration.ofMinutes(30),
            "",
            new SyncProperties.SyncPostSecurity("secret-token", allowedInternalCidrs, Duration.ofMinutes(15))
        ));
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:sync-controller-security-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
