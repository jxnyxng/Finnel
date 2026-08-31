package com.example.krwwatcher.batch.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import com.example.krwwatcher.service.NewsService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.item.ExecutionContext;

class NewsBackfillJobLauncherTest {

    @Test
    void mapsBatchExecutionContextToSyncResult() throws Exception {
        JobLauncher jobLauncher = org.mockito.Mockito.mock(JobLauncher.class);
        Job job = org.mockito.Mockito.mock(Job.class);
        JobExecution execution = new JobExecution(1L);
        execution.setStatus(BatchStatus.COMPLETED);
        ExecutionContext context = execution.getExecutionContext();
        context.putString("sync.status", "SUCCESS");
        context.putString("sync.message", "news=8");
        context.putInt("sync.rows", 8);
        context.putString("sync.syncedAt", "2026-08-30T00:00:00Z");
        when(jobLauncher.run(any(), any())).thenReturn(execution);

        NewsBackfillJobLauncher launcher = new NewsBackfillJobLauncher(jobLauncher, job);

        NewsService.NewsSyncResult result = launcher.runManualBackfill();

        assertThat(result.status()).isEqualTo("SUCCESS");
        assertThat(result.message()).isEqualTo("news=8");
        assertThat(result.rows()).isEqualTo(8);
        assertThat(result.syncedAt()).isEqualTo(Instant.parse("2026-08-30T00:00:00Z"));
        ArgumentCaptor<JobParameters> parametersCaptor = ArgumentCaptor.forClass(JobParameters.class);
        verify(jobLauncher).run(any(), parametersCaptor.capture());
        assertThat(parametersCaptor.getValue().getString("operation")).isEqualTo("NEWS_BACKFILL");
        assertThat(parametersCaptor.getValue().getString("trigger")).isEqualTo("MANUAL");
        assertThat(parametersCaptor.getValue().getLong("requestedAt")).isPositive();
    }
}
