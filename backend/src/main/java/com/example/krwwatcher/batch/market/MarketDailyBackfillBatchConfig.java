package com.example.krwwatcher.batch.market;

import com.example.krwwatcher.batch.BatchJobNames;
import com.example.krwwatcher.service.MarketDataSyncService;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class MarketDailyBackfillBatchConfig {

    @Bean
    public Job marketDailyExchangeBackfillJob(JobRepository jobRepository, Step dailyExchangeBackfillTaskletStep) {
        return new JobBuilder(BatchJobNames.MARKET_DAILY_EXCHANGE_BACKFILL, jobRepository)
            .start(dailyExchangeBackfillTaskletStep)
            .build();
    }

    @Bean
    public Job marketExchangeRateHistoryBackfillJob(JobRepository jobRepository, Step exchangeRateHistoryBackfillTaskletStep) {
        return new JobBuilder(BatchJobNames.MARKET_EXCHANGE_RATE_HISTORY_BACKFILL, jobRepository)
            .start(exchangeRateHistoryBackfillTaskletStep)
            .build();
    }

    @Bean
    public Step dailyExchangeBackfillTaskletStep(
        JobRepository jobRepository,
        PlatformTransactionManager transactionManager,
        MarketDailyBackfillTasklet tasklet
    ) {
        return new StepBuilder("dailyExchangeBackfillTaskletStep", jobRepository)
            .tasklet(tasklet, transactionManager)
            .build();
    }

    @Bean
    public MarketDailyBackfillTasklet marketDailyBackfillTasklet(MarketDataSyncService marketDataSyncService) {
        return new MarketDailyBackfillTasklet(marketDataSyncService);
    }

    @Bean
    public Step exchangeRateHistoryBackfillTaskletStep(
        JobRepository jobRepository,
        PlatformTransactionManager transactionManager,
        MarketExchangeRateHistoryBackfillTasklet tasklet
    ) {
        return new StepBuilder("exchangeRateHistoryBackfillTaskletStep", jobRepository)
            .tasklet(tasklet, transactionManager)
            .build();
    }

    @Bean
    public MarketExchangeRateHistoryBackfillTasklet marketExchangeRateHistoryBackfillTasklet(MarketDataSyncService marketDataSyncService) {
        return new MarketExchangeRateHistoryBackfillTasklet(marketDataSyncService);
    }
}
