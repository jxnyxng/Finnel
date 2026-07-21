package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.function.IntSupplier;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

class MarketDataSyncRunStateTest {

    private JdbcTemplate jdbcTemplate;
    private MarketDataSyncService marketDataSyncService;

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
        jdbcTemplate.execute("""
            CREATE TABLE batch_job_source_runs (
                id BIGINT NOT NULL AUTO_INCREMENT,
                batch_job_run_id BIGINT NULL,
                job_name VARCHAR(100) NOT NULL,
                source_name VARCHAR(100) NOT NULL,
                status VARCHAR(30) NOT NULL,
                rows_processed INT NOT NULL DEFAULT 0,
                error_code VARCHAR(100) NULL,
                error_message VARCHAR(1000) NULL,
                started_at TIMESTAMP NOT NULL,
                ended_at TIMESTAMP NULL,
                PRIMARY KEY (id)
            )
            """);
        marketDataSyncService = new MarketDataSyncService(null, null, null, null, null, null, null, null, null, null, jdbcTemplate);
    }

    @Test
    void failedCoreSourceCanRetryBeforeSuccessfulSourceCooldownExpires() {
        Instant now = Instant.parse("2026-07-21T00:00:00Z");
        insertSourceRun("MARKET_DATA_SYNC", "exchange", "FAILED", now);
        insertSourceRun("MARKET_DATA_SYNC", "dollarIndex", "SUCCESS", now);

        Boolean failedSourceCanRetry = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "canRunSource",
            "MARKET_DATA_SYNC",
            "exchange",
            Duration.ofMinutes(15),
            now.plus(Duration.ofMinutes(1))
        );
        Boolean successfulSourceCanRetry = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "canRunSource",
            "MARKET_DATA_SYNC",
            "dollarIndex",
            Duration.ofMinutes(15),
            now.plus(Duration.ofMinutes(1))
        );

        assertThat(failedSourceCanRetry).isTrue();
        assertThat(successfulSourceCanRetry).isFalse();
    }

    @Test
    void staleRunningJobDoesNotBlockManualSyncForever() {
        Instant now = Instant.parse("2026-07-21T03:00:00Z");
        jdbcTemplate.update(
            "INSERT INTO batch_job_runs (job_name, status, started_at, message) VALUES (?, ?, ?, ?)",
            "MARKET_DATA_SYNC",
            "RUNNING",
            now.minus(Duration.ofHours(3)),
            "old running"
        );

        Object syncWindow = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "currentSyncWindow",
            "MARKET_DATA_SYNC",
            Duration.ofMinutes(15),
            now
        );
        Object latestJob = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "findLatestJob",
            "MARKET_DATA_SYNC"
        );

        Boolean canSync = ReflectionTestUtils.invokeMethod(syncWindow, "canSync");
        String latestStatus = ReflectionTestUtils.invokeMethod(latestJob, "status");

        assertThat(canSync).isTrue();
        assertThat(latestStatus).isEqualTo("STALE_RUNNING");
    }

    @Test
    void sourceRunFailureIsRecordedWithStructuredErrorDetails() throws Exception {
        Class<?> counterClass = Class.forName("com.example.krwwatcher.service.MarketDataSyncService$SyncCounter");
        var constructor = counterClass.getDeclaredConstructor();
        constructor.setAccessible(true);
        Object counter = constructor.newInstance();
        IntSupplier failingSource = () -> {
            throw new IllegalStateException("ECOS quota exceeded");
        };

        Integer rows = ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "runSource",
            null,
            "MARKET_DATA_SYNC",
            "krRate",
            counter,
            Duration.ofMinutes(15),
            failingSource
        );

        assertThat(rows).isZero();
        String sourceRun = jdbcTemplate.queryForObject(
            """
                SELECT CONCAT(job_name, '|', source_name, '|', status, '|', rows_processed, '|', error_code, '|', error_message)
                FROM batch_job_source_runs
                WHERE source_name = 'krRate'
                """,
            String.class
        );
        assertThat(sourceRun).isEqualTo("MARKET_DATA_SYNC|krRate|FAILED|0|IllegalStateException|ECOS quota exceeded");
    }

    private void insertSourceRun(String jobName, String sourceName, String status, Instant startedAt) {
        jdbcTemplate.update(
            """
                INSERT INTO batch_job_source_runs
                    (job_name, source_name, status, rows_processed, started_at, ended_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
            jobName,
            sourceName,
            status,
            "SUCCESS".equals(status) ? 1 : 0,
            startedAt,
            startedAt.plusSeconds(1)
        );
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:market-data-sync-run-state-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
