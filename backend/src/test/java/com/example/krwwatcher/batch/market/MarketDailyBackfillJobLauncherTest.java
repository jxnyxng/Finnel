package com.example.krwwatcher.batch.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import com.example.krwwatcher.service.MarketDataSyncService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.item.ExecutionContext;

class MarketDailyBackfillJobLauncherTest {

    @Test
    void mapsBatchExecutionContextToSyncResult() throws Exception {
        JobLauncher jobLauncher = org.mockito.Mockito.mock(JobLauncher.class);
        Job job = org.mockito.Mockito.mock(Job.class);
        JobExecution execution = new JobExecution(1L);
        execution.setStatus(BatchStatus.COMPLETED);
        ExecutionContext context = execution.getExecutionContext();
        context.putInt("sync.exchangeRateRows", 3);
        context.putInt("sync.intradayExchangeRateRows", 0);
        context.putInt("sync.dollarIndexRows", 0);
        context.putInt("sync.currencyStrengthRows", 0);
        context.putInt("sync.usPolicyRateRows", 0);
        context.putInt("sync.krPolicyRateRows", 0);
        context.putInt("sync.foreignReserveRows", 0);
        context.putInt("sync.domesticPolicyRows", 0);
        context.putString("sync.status", "SUCCESS");
        context.putString("sync.message", "dailyBackfill=3");
        context.putString("sync.trigger", "DAILY_BACKFILL");
        context.putString("sync.startedAt", "2026-08-30T00:00:00Z");
        context.putString("sync.nextAllowedAt", "2026-08-30T00:30:00Z");
        context.putLong("sync.remainingCooldownSeconds", 1800);
        when(jobLauncher.run(any(), any())).thenReturn(execution);

        MarketDailyBackfillJobLauncher launcher = new MarketDailyBackfillJobLauncher(jobLauncher, job);

        MarketDataSyncService.SyncResult result = launcher.runManualDailyBackfill();

        assertThat(result.exchangeRateRows()).isEqualTo(3);
        assertThat(result.status()).isEqualTo("SUCCESS");
        assertThat(result.message()).isEqualTo("dailyBackfill=3");
        assertThat(result.trigger()).isEqualTo("DAILY_BACKFILL");
        assertThat(result.startedAt()).isEqualTo(Instant.parse("2026-08-30T00:00:00Z"));
        assertThat(result.nextAllowedAt()).isEqualTo(Instant.parse("2026-08-30T00:30:00Z"));
        assertThat(result.remainingCooldownSeconds()).isEqualTo(1800);
        ArgumentCaptor<JobParameters> parametersCaptor = ArgumentCaptor.forClass(JobParameters.class);
        verify(jobLauncher).run(any(), parametersCaptor.capture());
        assertThat(parametersCaptor.getValue().getString("operation")).isEqualTo("DAILY_EXCHANGE_BACKFILL");
        assertThat(parametersCaptor.getValue().getString("trigger")).isEqualTo("MANUAL");
        assertThat(parametersCaptor.getValue().getString("requestedAt")).isNotBlank();
    }
}
