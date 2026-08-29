package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MarketDataSourceRunCoordinatorTest {

    private JdbcTemplate jdbcTemplate;
    private MarketDataSourceRunCoordinator coordinator;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
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
        coordinator = new MarketDataSourceRunCoordinator(jdbcTemplate);
    }

    @Test
    void recordsSkippedCooldownWithoutRunningSource() {
        MarketDataSyncRunTracker tracker = new MarketDataSyncRunTracker();

        int rows = coordinator.runSource(
            null,
            "MARKET_DATA_SYNC",
            "exchange",
            tracker,
            Duration.ofMinutes(15),
            () -> {
                throw new AssertionError("supplier must not run");
            },
            (jobName, sourceName, cooldown, now) -> false,
            sourceName -> true
        );

        assertThat(rows).isZero();
        assertThat(findSourceRun()).isEqualTo("MARKET_DATA_SYNC|exchange|SKIPPED_COOLDOWN|0|null|null|TRUE");
        assertThat(tracker.messageSuffix()).contains("exchange=SKIPPED_COOLDOWN");
    }

    @Test
    void recordsSuccessfulSourceRows() {
        MarketDataSyncRunTracker tracker = new MarketDataSyncRunTracker();

        int rows = coordinator.runSource(
            11L,
            "MARKET_DATA_SYNC",
            "krRate",
            tracker,
            Duration.ZERO,
            () -> 3,
            (jobName, sourceName, cooldown, now) -> true,
            sourceName -> true
        );

        assertThat(rows).isEqualTo(3);
        assertThat(findSourceRun()).isEqualTo("MARKET_DATA_SYNC|krRate|SUCCESS|3|null|null|TRUE");
        assertThat(tracker.status()).isEqualTo("SUCCESS");
    }

    @Test
    void recordsFailedSourceDetailsAndTrackerFailure() {
        MarketDataSyncRunTracker tracker = new MarketDataSyncRunTracker();

        int rows = coordinator.runSource(
            11L,
            "MARKET_DATA_SYNC",
            "krRate",
            tracker,
            Duration.ZERO,
            () -> {
                throw new IllegalStateException("ECOS quota exceeded");
            },
            (jobName, sourceName, cooldown, now) -> true,
            sourceName -> true
        );

        assertThat(rows).isZero();
        assertThat(findSourceRun()).isEqualTo("MARKET_DATA_SYNC|krRate|FAILED|0|IllegalStateException|ECOS quota exceeded|TRUE");
        assertThat(tracker.status()).isEqualTo("FAILED_CORE_SOURCE");
    }

    private String findSourceRun() {
        return jdbcTemplate.queryForObject(
            """
                SELECT CONCAT(job_name, '|', source_name, '|', status, '|', rows_processed, '|',
                    COALESCE(error_code, 'null'), '|', COALESCE(error_message, 'null'), '|', ended_at IS NOT NULL)
                FROM batch_job_source_runs
                ORDER BY id DESC
                LIMIT 1
                """,
            String.class
        );
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:market-source-run-coordinator-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
