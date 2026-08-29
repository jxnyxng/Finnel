package com.example.krwwatcher.service;

import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.function.IntSupplier;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;

// Coordinates source-level market data sync run records and failure tracking.
class MarketDataSourceRunCoordinator {

    private final JdbcTemplate jdbcTemplate;

    MarketDataSourceRunCoordinator(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    int runSource(
        Long jobId,
        String jobName,
        String sourceName,
        MarketDataSyncRunTracker tracker,
        Duration sourceCooldown,
        IntSupplier supplier,
        SourceRunGate sourceRunGate,
        CoreSourceClassifier coreSourceClassifier
    ) {
        Instant startedAt = Instant.now();
        if (!sourceRunGate.canRun(jobName, sourceName, sourceCooldown, startedAt)) {
            recordSourceRun(jobId, jobName, sourceName, "SKIPPED_COOLDOWN", 0, null, null, startedAt, startedAt);
            tracker.recordSkippedSource(sourceName);
            return 0;
        }

        Long sourceRunId = startSourceRun(jobId, jobName, sourceName, startedAt);
        try {
            int rows = supplier.getAsInt();
            finishSourceRun(sourceRunId, "SUCCESS", rows, null, null, Instant.now());
            return rows;
        } catch (RuntimeException exception) {
            tracker.recordFailure(sourceName, coreSourceClassifier.isCoreSource(sourceName), exception);
            finishSourceRun(sourceRunId, "FAILED", 0, exception.getClass().getSimpleName(), exception.getMessage(), Instant.now());
            return 0;
        }
    }

    private void recordSourceRun(
        Long jobId,
        String jobName,
        String sourceName,
        String status,
        int rows,
        String errorCode,
        String errorMessage,
        Instant startedAt,
        Instant endedAt
    ) {
        jdbcTemplate.update(
            """
                INSERT INTO batch_job_source_runs
                    (batch_job_run_id, job_name, source_name, status, rows_processed, error_code, error_message, started_at, ended_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
            jobId,
            jobName,
            sourceName,
            status,
            rows,
            errorCode,
            truncateErrorMessage(errorMessage),
            startedAt,
            endedAt
        );
    }

    private Long startSourceRun(Long jobId, String jobName, String sourceName, Instant startedAt) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            java.sql.PreparedStatement statement = connection.prepareStatement(
                """
                    INSERT INTO batch_job_source_runs
                        (batch_job_run_id, job_name, source_name, status, rows_processed, started_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                Statement.RETURN_GENERATED_KEYS
            );
            if (jobId == null) {
                statement.setNull(1, java.sql.Types.BIGINT);
            } else {
                statement.setLong(1, jobId);
            }
            statement.setString(2, jobName);
            statement.setString(3, sourceName);
            statement.setString(4, "RUNNING");
            statement.setInt(5, 0);
            statement.setTimestamp(6, Timestamp.from(startedAt));
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("Failed to create source run");
        }
        return key.longValue();
    }

    private void finishSourceRun(Long sourceRunId, String status, int rows, String errorCode, String errorMessage, Instant endedAt) {
        jdbcTemplate.update(
            """
                UPDATE batch_job_source_runs
                SET status = ?,
                    rows_processed = ?,
                    error_code = ?,
                    error_message = ?,
                    ended_at = ?
                WHERE id = ?
                """,
            status,
            rows,
            errorCode,
            truncateErrorMessage(errorMessage),
            endedAt,
            sourceRunId
        );
    }

    private String truncateErrorMessage(String errorMessage) {
        if (errorMessage == null || errorMessage.length() <= 1000) {
            return errorMessage;
        }

        return errorMessage.substring(0, 1000);
    }

    interface SourceRunGate {
        boolean canRun(String jobName, String sourceName, Duration cooldown, Instant now);
    }

    interface CoreSourceClassifier {
        boolean isCoreSource(String sourceName);
    }
}
