package com.example.krwwatcher.batch.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import com.example.krwwatcher.service.GovernmentBriefingService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.scope.context.StepContext;
import org.springframework.batch.repeat.RepeatStatus;

class GovernmentBriefingBackfillTaskletTest {

    @Test
    void passesMonthsParameterToServiceAndStoresResult() {
        GovernmentBriefingService governmentBriefingService = org.mockito.Mockito.mock(GovernmentBriefingService.class);
        when(governmentBriefingService.backfill(12)).thenReturn(new GovernmentBriefingService.GovernmentBriefingSyncResult(
            "SUCCESS",
            "briefings=5, fetched=8, calls=2",
            5,
            Instant.parse("2026-08-30T00:00:00Z")
        ));
        GovernmentBriefingBackfillTasklet tasklet = new GovernmentBriefingBackfillTasklet(governmentBriefingService);
        JobParameters parameters = new JobParametersBuilder()
            .addLong("months", 12L)
            .toJobParameters();
        JobExecution jobExecution = new JobExecution(1L, parameters);
        StepExecution stepExecution = new StepExecution("governmentBriefingBackfillTaskletStep", jobExecution);
        StepContribution contribution = new StepContribution(stepExecution);

        RepeatStatus status = tasklet.execute(contribution, new ChunkContext(new StepContext(stepExecution)));

        assertThat(status).isEqualTo(RepeatStatus.FINISHED);
        ArgumentCaptor<Integer> monthsCaptor = ArgumentCaptor.forClass(Integer.class);
        verify(governmentBriefingService).backfill(monthsCaptor.capture());
        assertThat(monthsCaptor.getValue()).isEqualTo(12);
        assertThat(jobExecution.getExecutionContext().getString("sync.status")).isEqualTo("SUCCESS");
        assertThat(jobExecution.getExecutionContext().getString("sync.message")).isEqualTo("briefings=5, fetched=8, calls=2");
        assertThat(jobExecution.getExecutionContext().getInt("sync.rows")).isEqualTo(5);
        assertThat(jobExecution.getExecutionContext().getString("sync.syncedAt")).isEqualTo("2026-08-30T00:00:00Z");
        assertThat(contribution.getWriteCount()).isEqualTo(5);
        assertThat(contribution.getExitStatus().getExitCode()).isEqualTo("SUCCESS");
    }
}
