package com.example.krwwatcher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import com.example.krwwatcher.batch.content.NewsBackfillJobLauncher;
import com.example.krwwatcher.service.NewsService;
import org.junit.jupiter.api.Test;

class NewsControllerTest {

    @Test
    void syncUsesBatchLauncherWhenConfigured() {
        NewsService newsService = org.mockito.Mockito.mock(NewsService.class);
        NewsBackfillJobLauncher backfillJobLauncher = org.mockito.Mockito.mock(NewsBackfillJobLauncher.class);
        NewsService.NewsSyncResult expected = syncResult("SUCCESS", 4);
        when(backfillJobLauncher.runManualBackfill()).thenReturn(expected);
        NewsController controller = new NewsController(newsService, backfillJobLauncher);

        NewsService.NewsSyncResult result = controller.sync();

        assertThat(result).isEqualTo(expected);
        verify(backfillJobLauncher).runManualBackfill();
        verify(newsService, never()).syncNews();
    }

    @Test
    void syncFallsBackToServiceWhenLauncherIsNotConfigured() {
        NewsService newsService = org.mockito.Mockito.mock(NewsService.class);
        NewsService.NewsSyncResult expected = syncResult("SUCCESS", 3);
        when(newsService.syncNews()).thenReturn(expected);
        NewsController controller = new NewsController(newsService);

        NewsService.NewsSyncResult result = controller.sync();

        assertThat(result).isEqualTo(expected);
        verify(newsService).syncNews();
    }

    private NewsService.NewsSyncResult syncResult(String status, int rows) {
        return new NewsService.NewsSyncResult(
            status,
            "test",
            rows,
            Instant.parse("2026-08-30T00:00:00Z")
        );
    }
}
