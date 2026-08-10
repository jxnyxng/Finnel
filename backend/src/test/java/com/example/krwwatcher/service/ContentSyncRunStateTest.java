package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import javax.sql.DataSource;

import com.example.krwwatcher.config.SyncProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

class ContentSyncRunStateTest {

    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
        jdbcTemplate.execute("""
            CREATE TABLE batch_job_runs (
                id BIGINT NOT NULL AUTO_INCREMENT,
                job_name VARCHAR(100) NOT NULL,
                status VARCHAR(30) NOT NULL,
                started_at TIMESTAMP NOT NULL,
                ended_at TIMESTAMP NULL,
                message VARCHAR(1000) NULL,
                PRIMARY KEY (id)
            )
            """);
    }

    @Test
    void newsStartupCleanupMarksInterruptedRunAsFailed() {
        Long jobId = insertRunningJob("NEWS_SYNC", "latest sync started");
        NewsService newsService = new NewsService(null, null, jdbcTemplate, null, null);

        ReflectionTestUtils.invokeMethod(
            newsService,
            "markInterruptedRunningJob",
            Instant.parse("2026-08-09T06:45:00Z")
        );

        assertThat(findJobStatus(jobId)).isEqualTo("FAILED|TRUE|latest sync started, interrupted=backend-restarted");
    }

    @Test
    void governmentBriefingStartupCleanupMarksInterruptedRunAsFailed() {
        Long jobId = insertRunningJob("GOVERNMENT_BRIEFING_SYNC", "latest sync started");
        GovernmentBriefingService governmentBriefingService = new GovernmentBriefingService(null, null, jdbcTemplate);

        ReflectionTestUtils.invokeMethod(
            governmentBriefingService,
            "markInterruptedRunningJob",
            Instant.parse("2026-08-09T06:45:00Z")
        );

        assertThat(findJobStatus(jobId)).isEqualTo("FAILED|TRUE|latest sync started, interrupted=backend-restarted");
    }

    @Test
    void contentStartupCleanupDoesNotTouchOtherJobs() {
        Long newsJobId = insertRunningJob("NEWS_SYNC", "latest sync started");
        Long governmentJobId = insertRunningJob("GOVERNMENT_BRIEFING_SYNC", "latest sync started");
        NewsService newsService = new NewsService(null, null, jdbcTemplate, null, null);

        ReflectionTestUtils.invokeMethod(
            newsService,
            "markInterruptedRunningJob",
            Instant.parse("2026-08-09T06:45:00Z")
        );

        assertThat(findJobStatus(newsJobId)).isEqualTo("FAILED|TRUE|latest sync started, interrupted=backend-restarted");
        assertThat(findJobStatus(governmentJobId)).isEqualTo("RUNNING|FALSE|latest sync started");
    }

    @Test
    void disabledContentSyncSkipsManualNewsSyncBeforeClientAccess() {
        NewsService newsService = new NewsService(null, disabledSyncProperties(), jdbcTemplate, null, null);

        NewsService.NewsSyncResult result = newsService.syncLatestNews();

        assertThat(result.status()).isEqualTo("SKIPPED_DISABLED");
        assertThat(result.rows()).isZero();
    }

    @Test
    void disabledContentSyncSkipsManualGovernmentBriefingSyncBeforeClientAccess() {
        GovernmentBriefingService governmentBriefingService = new GovernmentBriefingService(null, disabledSyncProperties(), jdbcTemplate);

        GovernmentBriefingService.GovernmentBriefingSyncResult result = governmentBriefingService.syncLatest();

        assertThat(result.status()).isEqualTo("SKIPPED_DISABLED");
        assertThat(result.rows()).isZero();
    }

    private Long insertRunningJob(String jobName, String message) {
        jdbcTemplate.update(
            "INSERT INTO batch_job_runs (job_name, status, started_at, message) VALUES (?, ?, ?, ?)",
            jobName,
            "RUNNING",
            Instant.parse("2026-08-09T06:40:00Z"),
            message
        );
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM batch_job_runs", Long.class);
    }

    private String findJobStatus(Long jobId) {
        return jdbcTemplate.queryForObject(
            "SELECT CONCAT(status, '|', ended_at IS NOT NULL, '|', message) FROM batch_job_runs WHERE id = ?",
            String.class,
            jobId
        );
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:content-sync-run-state-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }

    private SyncProperties disabledSyncProperties() {
        return new SyncProperties(
            new SyncProperties.Content(false),
            new SyncProperties.MarketData(
                false,
                Duration.ofMinutes(15),
                "",
                "Asia/Seoul",
                Duration.ofMinutes(5),
                "",
                Duration.ofHours(1),
                3,
                Duration.ofMinutes(30),
                "",
                new SyncProperties.SyncPostSecurity("", "", Duration.ofMinutes(15))
            )
        );
    }
}
