package com.example.krwwatcher.batch.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import com.example.krwwatcher.service.NewsService;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.scope.context.StepContext;
import org.springframework.batch.repeat.RepeatStatus;

class NewsBackfillTaskletTest {

    @Test
    void callsSyncNewsAndStoresResult() {
        NewsService newsService = org.mockito.Mockito.mock(NewsService.class);
        when(newsService.syncNews()).thenReturn(new NewsService.NewsSyncResult(
            "SUCCESS",
            "news=6",
            6,
            Instant.parse("2026-08-30T00:00:00Z")
        ));
        NewsBackfillTasklet tasklet = new NewsBackfillTasklet(newsService);
        JobExecution jobExecution = new JobExecution(1L);
        StepExecution stepExecution = new StepExecution("newsBackfillTaskletStep", jobExecution);
        StepContribution contribution = new StepContribution(stepExecution);

        RepeatStatus status = tasklet.execute(contribution, new ChunkContext(new StepContext(stepExecution)));

        assertThat(status).isEqualTo(RepeatStatus.FINISHED);
        verify(newsService).syncNews();
        assertThat(jobExecution.getExecutionContext().getString("sync.status")).isEqualTo("SUCCESS");
        assertThat(jobExecution.getExecutionContext().getString("sync.message")).isEqualTo("news=6");
        assertThat(jobExecution.getExecutionContext().getInt("sync.rows")).isEqualTo(6);
        assertThat(jobExecution.getExecutionContext().getString("sync.syncedAt")).isEqualTo("2026-08-30T00:00:00Z");
        assertThat(contribution.getWriteCount()).isEqualTo(6);
        assertThat(contribution.getExitStatus().getExitCode()).isEqualTo("SUCCESS");
    }
}
