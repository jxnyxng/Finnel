package com.example.krwwatcher.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.dao.CannotAcquireLockException;

class BatchJobLaunchSupportTest {

    @Test
    void retriesCannotAcquireLockFailure() throws Exception {
        JobLauncher jobLauncher = org.mockito.Mockito.mock(JobLauncher.class);
        Job job = org.mockito.Mockito.mock(Job.class);
        JobParameters parameters = new JobParameters();
        JobExecution execution = new JobExecution(1L);
        execution.setStatus(BatchStatus.COMPLETED);
        when(jobLauncher.run(any(), any()))
            .thenThrow(new CannotAcquireLockException("deadlock"))
            .thenReturn(execution);

        JobExecution result = BatchJobLaunchSupport.runWithLockRetry(jobLauncher, job, parameters);

        assertThat(result).isSameAs(execution);
        verify(jobLauncher, times(2)).run(job, parameters);
    }
}
