package com.example.krwwatcher.batch.content;

import com.example.krwwatcher.service.NewsService;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;

public class NewsBackfillTasklet implements Tasklet {

    private final NewsService newsService;

    public NewsBackfillTasklet(NewsService newsService) {
        this.newsService = newsService;
    }

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        NewsService.NewsSyncResult result = newsService.syncNews();
        contribution.incrementWriteCount(result.rows());
        contribution.setExitStatus(new ExitStatus(result.status(), result.message()));
        NewsSyncResultExecutionContextMapper.put(
            chunkContext.getStepContext().getStepExecution().getJobExecution().getExecutionContext(),
            result
        );
        return RepeatStatus.FINISHED;
    }
}
