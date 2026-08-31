package com.example.krwwatcher.batch.content;

import com.example.krwwatcher.batch.BatchJobNames;
import com.example.krwwatcher.batch.BatchJobLaunchSupport;
import com.example.krwwatcher.service.NewsService;
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
public class NewsBackfillJobLauncher {

    private final JobLauncher jobLauncher;
    private final Job newsBackfillJob;

    public NewsBackfillJobLauncher(
        JobLauncher jobLauncher,
        @Qualifier(BatchJobNames.NEWS_BACKFILL) Job newsBackfillJob
    ) {
        this.jobLauncher = jobLauncher;
        this.newsBackfillJob = newsBackfillJob;
    }

    public NewsService.NewsSyncResult runManualBackfill() {
        try {
            JobExecution execution = BatchJobLaunchSupport.runWithLockRetry(jobLauncher, newsBackfillJob, manualParameters());
            return toSyncResult(execution);
        } catch (JobExecutionAlreadyRunningException exception) {
            return failedResult("SKIPPED_RUNNING", "News backfill batch job is already running");
        } catch (JobRestartException | JobInstanceAlreadyCompleteException | JobParametersInvalidException exception) {
            throw new IllegalStateException("Failed to launch news backfill batch job", exception);
        }
    }

    private JobParameters manualParameters() {
        return new JobParametersBuilder()
            .addString("operation", "NEWS_BACKFILL")
            .addString("trigger", "MANUAL")
            .addLong("requestedAt", System.currentTimeMillis())
            .toJobParameters();
    }

    private NewsService.NewsSyncResult toSyncResult(JobExecution execution) {
        ExecutionContext context = execution.getExecutionContext();
        if (NewsSyncResultExecutionContextMapper.containsResult(context)) {
            return NewsSyncResultExecutionContextMapper.get(context);
        }

        if (execution.getStatus() == BatchStatus.COMPLETED) {
            return failedResult("SUCCESS", execution.getExitStatus().getExitDescription());
        }

        return failedResult(
            execution.getStatus().name(),
            execution.getExitStatus() == null ? "News backfill batch job ended without result" : execution.getExitStatus().getExitDescription()
        );
    }

    private NewsService.NewsSyncResult failedResult(String status, String message) {
        return new NewsService.NewsSyncResult(
            status,
            message == null ? "" : message,
            0,
            null
        );
    }
}
