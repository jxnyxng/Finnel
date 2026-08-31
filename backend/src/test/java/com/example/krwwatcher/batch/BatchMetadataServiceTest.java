package com.example.krwwatcher.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobInstance;
import org.springframework.batch.core.JobParameter;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.explore.JobExplorer;

class BatchMetadataServiceTest {

    @Test
    void listsJobsWithLatestExecutionSummary() {
        JobExplorer jobExplorer = org.mockito.Mockito.mock(JobExplorer.class);
        JobInstance instance = new JobInstance(1L, BatchJobNames.NEWS_BACKFILL);
        JobExecution olderExecution = execution(instance, 10L, "2026-08-30T00:00:00");
        JobExecution latestExecution = execution(instance, 11L, "2026-08-31T00:00:00");
        StepExecution stepExecution = new StepExecution("newsBackfillTaskletStep", latestExecution);
        stepExecution.setStatus(BatchStatus.COMPLETED);
        stepExecution.setExitStatus(ExitStatus.COMPLETED);
        stepExecution.setWriteCount(7);
        latestExecution.addStepExecutions(List.of(stepExecution));
        when(jobExplorer.getJobNames()).thenReturn(List.of(BatchJobNames.NEWS_BACKFILL));
        when(jobExplorer.getJobInstances(BatchJobNames.NEWS_BACKFILL, 0, 20)).thenReturn(List.of(instance));
        when(jobExplorer.getJobExecutions(instance)).thenReturn(List.of(olderExecution, latestExecution));

        BatchMetadataService.BatchJobsResponse response = new BatchMetadataService(jobExplorer).jobs();

        assertThat(response.jobs()).hasSize(1);
        BatchMetadataService.BatchJobExecutionSummary latest = response.jobs().get(0).latestExecution();
        assertThat(latest.executionId()).isEqualTo(11L);
        assertThat(latest.jobName()).isEqualTo(BatchJobNames.NEWS_BACKFILL);
        assertThat(latest.status()).isEqualTo("COMPLETED");
        assertThat(latest.parameters().get("operation").value()).isEqualTo("NEWS_BACKFILL");
        assertThat(latest.steps()).hasSize(1);
        assertThat(latest.steps().get(0).stepName()).isEqualTo("newsBackfillTaskletStep");
        assertThat(latest.steps().get(0).writeCount()).isEqualTo(7);
    }

    @Test
    void capsExecutionLimit() {
        JobExplorer jobExplorer = org.mockito.Mockito.mock(JobExplorer.class);
        when(jobExplorer.getJobInstances(BatchJobNames.NEWS_BACKFILL, 0, 100)).thenReturn(List.of());

        BatchMetadataService.BatchJobExecutionsResponse response = new BatchMetadataService(jobExplorer)
            .executions(BatchJobNames.NEWS_BACKFILL, 999);

        assertThat(response.executions()).isEmpty();
    }

    private JobExecution execution(JobInstance instance, long id, String createdAt) {
        JobParameters parameters = new JobParameters(
            java.util.Map.of("operation", new JobParameter<>("NEWS_BACKFILL", String.class, true))
        );
        JobExecution execution = new JobExecution(instance, id, parameters);
        execution.setStatus(BatchStatus.COMPLETED);
        execution.setExitStatus(ExitStatus.COMPLETED);
        execution.setCreateTime(LocalDateTime.parse(createdAt));
        return execution;
    }
}
