package com.example.krwwatcher.batch.content;

import com.example.krwwatcher.service.GovernmentBriefingService;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;

public class GovernmentBriefingBackfillTasklet implements Tasklet {

    private final GovernmentBriefingService governmentBriefingService;

    public GovernmentBriefingBackfillTasklet(GovernmentBriefingService governmentBriefingService) {
        this.governmentBriefingService = governmentBriefingService;
    }

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        int months = Math.toIntExact((Long) chunkContext.getStepContext().getJobParameters().get("months"));
        GovernmentBriefingService.GovernmentBriefingSyncResult result = governmentBriefingService.backfill(months);
        contribution.incrementWriteCount(result.rows());
        contribution.setExitStatus(new ExitStatus(result.status(), result.message()));
        GovernmentBriefingSyncResultExecutionContextMapper.put(
            chunkContext.getStepContext().getStepExecution().getJobExecution().getExecutionContext(),
            result
        );
        return RepeatStatus.FINISHED;
    }
}
