package com.example.krwwatcher.batch.market;

import com.example.krwwatcher.service.MarketDataSyncService;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.scope.context.StepContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.item.ExecutionContext;
import org.springframework.batch.repeat.RepeatStatus;

public class MarketDailyBackfillTasklet implements Tasklet {

    private final MarketDataSyncService marketDataSyncService;

    public MarketDailyBackfillTasklet(MarketDataSyncService marketDataSyncService) {
        this.marketDataSyncService = marketDataSyncService;
    }

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        MarketDataSyncService.SyncResult result = marketDataSyncService.requestDailyBackfill();
        contribution.incrementWriteCount(result.exchangeRateRows());
        contribution.setExitStatus(new ExitStatus(result.status(), result.message()));
        putResult(chunkContext.getStepContext(), result);
        return RepeatStatus.FINISHED;
    }

    private void putResult(StepContext stepContext, MarketDataSyncService.SyncResult result) {
        ExecutionContext context = stepContext.getStepExecution().getJobExecution().getExecutionContext();
        context.putInt("sync.exchangeRateRows", result.exchangeRateRows());
        context.putInt("sync.intradayExchangeRateRows", result.intradayExchangeRateRows());
        context.putInt("sync.dollarIndexRows", result.dollarIndexRows());
        context.putInt("sync.currencyStrengthRows", result.currencyStrengthRows());
        context.putInt("sync.usPolicyRateRows", result.usPolicyRateRows());
        context.putInt("sync.krPolicyRateRows", result.krPolicyRateRows());
        context.putInt("sync.foreignReserveRows", result.foreignReserveRows());
        context.putInt("sync.domesticPolicyRows", result.domesticPolicyRows());
        context.putString("sync.status", result.status());
        context.putString("sync.message", result.message());
        context.putString("sync.trigger", result.trigger());
        if (result.startedAt() != null) {
            context.putString("sync.startedAt", result.startedAt().toString());
        }
        if (result.nextAllowedAt() != null) {
            context.putString("sync.nextAllowedAt", result.nextAllowedAt().toString());
        }
        context.putLong("sync.remainingCooldownSeconds", result.remainingCooldownSeconds());
    }
}
