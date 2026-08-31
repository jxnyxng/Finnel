package com.example.krwwatcher.batch.content;

import com.example.krwwatcher.batch.BatchJobNames;
import com.example.krwwatcher.service.NewsService;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class NewsBackfillBatchConfig {

    @Bean
    public Job newsBackfillJob(JobRepository jobRepository, Step newsBackfillTaskletStep) {
        return new JobBuilder(BatchJobNames.NEWS_BACKFILL, jobRepository)
            .start(newsBackfillTaskletStep)
            .build();
    }

    @Bean
    public Step newsBackfillTaskletStep(
        JobRepository jobRepository,
        PlatformTransactionManager transactionManager,
        NewsBackfillTasklet tasklet
    ) {
        return new StepBuilder("newsBackfillTaskletStep", jobRepository)
            .tasklet(tasklet, transactionManager)
            .build();
    }

    @Bean
    public NewsBackfillTasklet newsBackfillTasklet(NewsService newsService) {
        return new NewsBackfillTasklet(newsService);
    }
}
