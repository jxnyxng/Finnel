package com.example.krwwatcher.batch.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import com.example.krwwatcher.service.GovernmentBriefingService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.item.ExecutionContext;

class GovernmentBriefingBackfillJobLauncherTest {

    @Test
    void mapsBatchExecutionContextToSyncResult() throws Exception {
        JobLauncher jobLauncher = org.mockito.Mockito.mock(JobLauncher.class);
        Job job = org.mockito.Mockito.mock(Job.class);
        JobExecution execution = new JobExecution(1L);
        execution.setStatus(BatchStatus.COMPLETED);
        ExecutionContext context = execution.getExecutionContext();
        context.putString("sync.status", "SUCCESS");
        context.putString("sync.message", "briefings=7, fetched=9, calls=3");
        context.putInt("sync.rows", 7);
        context.putString("sync.syncedAt", "2026-08-30T00:00:00Z");
        when(jobLauncher.run(any(), any())).thenReturn(execution);

        GovernmentBriefingBackfillJobLauncher launcher = new GovernmentBriefingBackfillJobLauncher(jobLauncher, job);

        GovernmentBriefingService.GovernmentBriefingSyncResult result = launcher.runManualBackfill(12);

        assertThat(result.status()).isEqualTo("SUCCESS");
        assertThat(result.message()).isEqualTo("briefings=7, fetched=9, calls=3");
        assertThat(result.rows()).isEqualTo(7);
        assertThat(result.syncedAt()).isEqualTo(Instant.parse("2026-08-30T00:00:00Z"));
        ArgumentCaptor<JobParameters> parametersCaptor = ArgumentCaptor.forClass(JobParameters.class);
        verify(jobLauncher).run(any(), parametersCaptor.capture());
        assertThat(parametersCaptor.getValue().getString("operation")).isEqualTo("GOVERNMENT_BRIEFING_BACKFILL");
        assertThat(parametersCaptor.getValue().getString("trigger")).isEqualTo("MANUAL");
        assertThat(parametersCaptor.getValue().getLong("months")).isEqualTo(12);
        assertThat(parametersCaptor.getValue().getLong("requestedAt")).isPositive();
    }
}
