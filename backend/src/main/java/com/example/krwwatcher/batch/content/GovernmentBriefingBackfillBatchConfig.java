package com.example.krwwatcher.batch.content;

import com.example.krwwatcher.batch.BatchJobNames;
import com.example.krwwatcher.service.GovernmentBriefingService;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class GovernmentBriefingBackfillBatchConfig {

    @Bean
    public Job governmentBriefingBackfillJob(JobRepository jobRepository, Step governmentBriefingBackfillTaskletStep) {
        return new JobBuilder(BatchJobNames.GOVERNMENT_BRIEFING_BACKFILL, jobRepository)
            .start(governmentBriefingBackfillTaskletStep)
            .build();
    }

    @Bean
    public Step governmentBriefingBackfillTaskletStep(
        JobRepository jobRepository,
        PlatformTransactionManager transactionManager,
        GovernmentBriefingBackfillTasklet tasklet
    ) {
        return new StepBuilder("governmentBriefingBackfillTaskletStep", jobRepository)
            .tasklet(tasklet, transactionManager)
            .build();
    }

    @Bean
    public GovernmentBriefingBackfillTasklet governmentBriefingBackfillTasklet(GovernmentBriefingService governmentBriefingService) {
        return new GovernmentBriefingBackfillTasklet(governmentBriefingService);
    }
}
