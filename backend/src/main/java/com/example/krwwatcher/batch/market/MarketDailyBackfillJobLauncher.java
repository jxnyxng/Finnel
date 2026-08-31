package com.example.krwwatcher.batch.market;

import com.example.krwwatcher.batch.BatchJobNames;
import com.example.krwwatcher.batch.BatchJobLaunchSupport;
import com.example.krwwatcher.service.MarketDataSyncService;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.JobParametersInvalidException;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.repository.JobExecutionAlreadyRunningException;
import org.springframework.batch.core.repository.JobInstanceAlreadyCompleteException;
import org.springframework.batch.core.repository.JobRestartException;
import org.springframework.batch.item.ExecutionContext;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
public class MarketDailyBackfillJobLauncher {

    private final JobLauncher jobLauncher;
    private final Job dailyBackfillJob;

    public MarketDailyBackfillJobLauncher(
        JobLauncher jobLauncher,
        @Qualifier(BatchJobNames.MARKET_DAILY_EXCHANGE_BACKFILL) Job dailyBackfillJob
    ) {
        this.jobLauncher = jobLauncher;
        this.dailyBackfillJob = dailyBackfillJob;
    }

    public MarketDataSyncService.SyncResult runManualDailyBackfill() {
        try {
            JobExecution execution = BatchJobLaunchSupport.runWithLockRetry(jobLauncher, dailyBackfillJob, manualParameters());
            return toSyncResult(execution);
        } catch (JobExecutionAlreadyRunningException exception) {
            return failedResult("SKIPPED_RUNNING", "Daily exchange backfill batch job is already running");
        } catch (JobRestartException | JobInstanceAlreadyCompleteException | JobParametersInvalidException exception) {
            throw new IllegalStateException("Failed to launch daily exchange backfill batch job", exception);
        }
    }

    private JobParameters manualParameters() {
        return new JobParametersBuilder()
            .addString("operation", "DAILY_EXCHANGE_BACKFILL")
            .addString("trigger", "MANUAL")
            .addLong("requestedAt", System.currentTimeMillis())
            .toJobParameters();
    }

    private MarketDataSyncService.SyncResult toSyncResult(JobExecution execution) {
        ExecutionContext context = execution.getExecutionContext();
        if (MarketSyncResultExecutionContextMapper.containsResult(context)) {
            return MarketSyncResultExecutionContextMapper.get(context);
        }

        if (execution.getStatus() == BatchStatus.COMPLETED) {
            return failedResult("SUCCESS", execution.getExitStatus().getExitDescription());
        }

        return failedResult(
            execution.getStatus().name(),
            execution.getExitStatus() == null ? "Daily exchange backfill batch job ended without result" : execution.getExitStatus().getExitDescription()
        );
    }

    private MarketDataSyncService.SyncResult failedResult(String status, String message) {
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
            message == null ? "" : message,
            "MANUAL",
            null,
            null,
            0
        );
    }
}
