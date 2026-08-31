package com.example.krwwatcher.batch;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersInvalidException;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.repository.JobExecutionAlreadyRunningException;
import org.springframework.batch.core.repository.JobInstanceAlreadyCompleteException;
import org.springframework.batch.core.repository.JobRestartException;
import org.springframework.dao.CannotAcquireLockException;

public final class BatchJobLaunchSupport {

    private static final int MAX_LOCK_ATTEMPTS = 3;
    private static final long LOCK_RETRY_BACKOFF_MILLIS = 100L;

    private BatchJobLaunchSupport() {
    }

    public static JobExecution runWithLockRetry(JobLauncher jobLauncher, Job job, JobParameters parameters)
        throws JobExecutionAlreadyRunningException, JobRestartException, JobInstanceAlreadyCompleteException, JobParametersInvalidException {
        CannotAcquireLockException lastException = null;
        for (int attempt = 1; attempt <= MAX_LOCK_ATTEMPTS; attempt++) {
            try {
                return jobLauncher.run(job, parameters);
            } catch (CannotAcquireLockException exception) {
                lastException = exception;
                if (attempt == MAX_LOCK_ATTEMPTS) {
                    break;
                }
                sleepBeforeRetry();
            }
        }

        throw lastException;
    }

    private static void sleepBeforeRetry() {
        try {
            Thread.sleep(LOCK_RETRY_BACKOFF_MILLIS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while retrying batch job launch", exception);
        }
    }
}
