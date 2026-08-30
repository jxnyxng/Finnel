package com.example.krwwatcher.batch.market;

import com.example.krwwatcher.service.MarketDataSyncService;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;

public class MarketExchangeRateHistoryBackfillTasklet implements Tasklet {

    private final MarketDataSyncService marketDataSyncService;

    public MarketExchangeRateHistoryBackfillTasklet(MarketDataSyncService marketDataSyncService) {
        this.marketDataSyncService = marketDataSyncService;
    }

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        MarketDataSyncService.SyncResult result = marketDataSyncService.requestExchangeRateHistoryBackfill();
        contribution.incrementWriteCount(result.exchangeRateRows());
        contribution.setExitStatus(new ExitStatus(result.status(), result.message()));
        MarketSyncResultExecutionContextMapper.put(
            chunkContext.getStepContext().getStepExecution().getJobExecution().getExecutionContext(),
            result
        );
        return RepeatStatus.FINISHED;
    }
}
