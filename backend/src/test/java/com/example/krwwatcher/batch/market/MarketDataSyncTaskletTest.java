package com.example.krwwatcher.batch.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import com.example.krwwatcher.service.MarketDataSyncService;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.scope.context.StepContext;
import org.springframework.batch.repeat.RepeatStatus;

class MarketDataSyncTaskletTest {

    @Test
    void callsManualSyncAndStoresResult() {
        MarketDataSyncService marketDataSyncService = org.mockito.Mockito.mock(MarketDataSyncService.class);
        when(marketDataSyncService.requestManualSync()).thenReturn(new MarketDataSyncService.SyncResult(
            2,
            0,
            3,
            4,
            5,
            6,
            7,
            8,
            "SUCCESS",
            "exchange=2, dollarIndex=3",
            "MANUAL",
            Instant.parse("2026-08-30T00:00:00Z"),
            Instant.parse("2026-08-30T00:15:00Z"),
            900
        ));
        MarketDataSyncTasklet tasklet = new MarketDataSyncTasklet(marketDataSyncService);
        JobExecution jobExecution = new JobExecution(1L);
        StepExecution stepExecution = new StepExecution("marketDataSyncTaskletStep", jobExecution);
        StepContribution contribution = new StepContribution(stepExecution);

        RepeatStatus status = tasklet.execute(contribution, new ChunkContext(new StepContext(stepExecution)));

        assertThat(status).isEqualTo(RepeatStatus.FINISHED);
        verify(marketDataSyncService).requestManualSync();
        assertThat(jobExecution.getExecutionContext().getString("sync.status")).isEqualTo("SUCCESS");
        assertThat(jobExecution.getExecutionContext().getString("sync.message")).isEqualTo("exchange=2, dollarIndex=3");
        assertThat(jobExecution.getExecutionContext().getInt("sync.exchangeRateRows")).isEqualTo(2);
        assertThat(jobExecution.getExecutionContext().getInt("sync.domesticPolicyRows")).isEqualTo(8);
        assertThat(contribution.getWriteCount()).isEqualTo(35);
        assertThat(contribution.getExitStatus().getExitCode()).isEqualTo("SUCCESS");
    }
}
