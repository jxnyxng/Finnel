package com.example.krwwatcher.batch.content;

import com.example.krwwatcher.batch.BatchJobNames;
import com.example.krwwatcher.batch.BatchJobLaunchSupport;
import com.example.krwwatcher.service.GovernmentBriefingService;
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
public class GovernmentBriefingBackfillJobLauncher {

    private final JobLauncher jobLauncher;
    private final Job governmentBriefingBackfillJob;

    public GovernmentBriefingBackfillJobLauncher(
        JobLauncher jobLauncher,
        @Qualifier(BatchJobNames.GOVERNMENT_BRIEFING_BACKFILL) Job governmentBriefingBackfillJob
    ) {
        this.jobLauncher = jobLauncher;
        this.governmentBriefingBackfillJob = governmentBriefingBackfillJob;
    }

    public GovernmentBriefingService.GovernmentBriefingSyncResult runManualBackfill(int months) {
        try {
            JobExecution execution = BatchJobLaunchSupport.runWithLockRetry(jobLauncher, governmentBriefingBackfillJob, manualParameters(months));
            return toSyncResult(execution);
        } catch (JobExecutionAlreadyRunningException exception) {
            return failedResult("SKIPPED_RUNNING", "Government briefing backfill batch job is already running");
        } catch (JobRestartException | JobInstanceAlreadyCompleteException | JobParametersInvalidException exception) {
            throw new IllegalStateException("Failed to launch government briefing backfill batch job", exception);
        }
    }

    private JobParameters manualParameters(int months) {
        return new JobParametersBuilder()
            .addString("operation", "GOVERNMENT_BRIEFING_BACKFILL")
            .addString("trigger", "MANUAL")
            .addLong("months", (long) months)
            .addLong("requestedAt", System.currentTimeMillis())
            .toJobParameters();
    }

    private GovernmentBriefingService.GovernmentBriefingSyncResult toSyncResult(JobExecution execution) {
        ExecutionContext context = execution.getExecutionContext();
        if (GovernmentBriefingSyncResultExecutionContextMapper.containsResult(context)) {
            return GovernmentBriefingSyncResultExecutionContextMapper.get(context);
        }

        if (execution.getStatus() == BatchStatus.COMPLETED) {
            return failedResult("SUCCESS", execution.getExitStatus().getExitDescription());
        }

        return failedResult(
            execution.getStatus().name(),
            execution.getExitStatus() == null ? "Government briefing backfill batch job ended without result" : execution.getExitStatus().getExitDescription()
        );
    }

    private GovernmentBriefingService.GovernmentBriefingSyncResult failedResult(String status, String message) {
        return new GovernmentBriefingService.GovernmentBriefingSyncResult(
            status,
            message == null ? "" : message,
            0,
            null
        );
    }
}
