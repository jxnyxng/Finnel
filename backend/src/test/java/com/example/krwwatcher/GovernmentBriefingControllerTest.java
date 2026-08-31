package com.example.krwwatcher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import com.example.krwwatcher.batch.content.GovernmentBriefingBackfillJobLauncher;
import com.example.krwwatcher.service.GovernmentBriefingService;
import org.junit.jupiter.api.Test;

class GovernmentBriefingControllerTest {

    @Test
    void backfillUsesBatchLauncherWhenConfigured() {
        GovernmentBriefingService governmentBriefingService = org.mockito.Mockito.mock(GovernmentBriefingService.class);
        GovernmentBriefingBackfillJobLauncher backfillJobLauncher = org.mockito.Mockito.mock(GovernmentBriefingBackfillJobLauncher.class);
        GovernmentBriefingService.GovernmentBriefingSyncResult expected = syncResult("SUCCESS", 4);
        when(backfillJobLauncher.runManualBackfill(12)).thenReturn(expected);
        GovernmentBriefingController controller = new GovernmentBriefingController(governmentBriefingService, backfillJobLauncher);

        GovernmentBriefingService.GovernmentBriefingSyncResult result = controller.backfill(12);

        assertThat(result).isEqualTo(expected);
        verify(backfillJobLauncher).runManualBackfill(12);
        verify(governmentBriefingService, never()).backfill(12);
    }

    @Test
    void backfillFallsBackToServiceWhenLauncherIsNotConfigured() {
        GovernmentBriefingService governmentBriefingService = org.mockito.Mockito.mock(GovernmentBriefingService.class);
        GovernmentBriefingService.GovernmentBriefingSyncResult expected = syncResult("SUCCESS", 3);
        when(governmentBriefingService.backfill(6)).thenReturn(expected);
        GovernmentBriefingController controller = new GovernmentBriefingController(governmentBriefingService);

        GovernmentBriefingService.GovernmentBriefingSyncResult result = controller.backfill(6);

        assertThat(result).isEqualTo(expected);
        verify(governmentBriefingService).backfill(6);
    }

    private GovernmentBriefingService.GovernmentBriefingSyncResult syncResult(String status, int rows) {
        return new GovernmentBriefingService.GovernmentBriefingSyncResult(
            status,
            "test",
            rows,
            Instant.parse("2026-08-30T00:00:00Z")
        );
    }
}
