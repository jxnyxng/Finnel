package com.example.krwwatcher.batch.market;

import com.example.krwwatcher.service.MarketDataSyncService;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;

public class MarketDataSyncTasklet implements Tasklet {

    private final MarketDataSyncService marketDataSyncService;

    public MarketDataSyncTasklet(MarketDataSyncService marketDataSyncService) {
        this.marketDataSyncService = marketDataSyncService;
    }

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        MarketDataSyncService.SyncResult result = marketDataSyncService.requestManualSync();
        contribution.incrementWriteCount(totalRows(result));
        contribution.setExitStatus(new ExitStatus(result.status(), result.message()));
        MarketSyncResultExecutionContextMapper.put(
            chunkContext.getStepContext().getStepExecution().getJobExecution().getExecutionContext(),
            result
        );
        return RepeatStatus.FINISHED;
    }

    private int totalRows(MarketDataSyncService.SyncResult result) {
        return result.exchangeRateRows()
            + result.intradayExchangeRateRows()
            + result.dollarIndexRows()
            + result.currencyStrengthRows()
            + result.usPolicyRateRows()
            + result.krPolicyRateRows()
            + result.foreignReserveRows()
            + result.domesticPolicyRows();
    }
}
