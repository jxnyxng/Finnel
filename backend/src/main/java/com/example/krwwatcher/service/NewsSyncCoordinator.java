package com.example.krwwatcher.service;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import java.util.function.Function;

import org.springframework.web.client.RestClientResponseException;

// Coordinates news sync job locking, job status recording, and result mapping.
class NewsSyncCoordinator {

    private final AtomicBoolean syncRunning;
    private final Function<String, String> responseBodyCleaner;

    NewsSyncCoordinator(AtomicBoolean syncRunning, Function<String, String> responseBodyCleaner) {
        this.syncRunning = syncRunning;
        this.responseBodyCleaner = responseBodyCleaner;
    }

    NewsService.NewsSyncResult run(
        String mode,
        boolean contentSyncEnabled,
        BooleanSupplier naverConfigured,
        SyncBody syncBody,
        JobStarter jobStarter,
        JobFinisher jobFinisher
    ) {
        if (!contentSyncEnabled) {
            return new NewsService.NewsSyncResult("SKIPPED_DISABLED", "콘텐츠 수집이 비활성화되어 있습니다.", 0, Instant.now());
        }

        if (!naverConfigured.getAsBoolean()) {
            return new NewsService.NewsSyncResult("SKIPPED_NOT_CONFIGURED", "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET 설정이 필요합니다.", 0, Instant.now());
        }

        if (!syncRunning.compareAndSet(false, true)) {
            return new NewsService.NewsSyncResult("SKIPPED_RUNNING", "뉴스 수집이 이미 진행 중입니다.", 0, Instant.now());
        }

        Instant startedAt = Instant.now();
        Long jobId = jobStarter.start(startedAt, mode);
        SyncProgress progress = new SyncProgress();
        try {
            syncBody.run(progress);
        } catch (RestClientResponseException exception) {
            Instant endedAt = Instant.now();
            String message = "네이버 뉴스 API HTTP " + exception.getStatusCode().value() + ": "
                + responseBodyCleaner.apply(exception.getResponseBodyAsString());
            jobFinisher.finish(jobId, "FAILED", endedAt, message);
            return new NewsService.NewsSyncResult(
                "NAVER_API_ERROR",
                message,
                progress.rows(),
                endedAt
            );
        } catch (RuntimeException exception) {
            Instant endedAt = Instant.now();
            String message = "뉴스 수집 실패: " + exception.getClass().getSimpleName();
            jobFinisher.finish(jobId, "FAILED", endedAt, message);
            return new NewsService.NewsSyncResult(
                "NEWS_SYNC_ERROR",
                message,
                progress.rows(),
                endedAt
            );
        } finally {
            syncRunning.set(false);
        }

        Instant syncedAt = Instant.now();
        int rows = progress.rows();
        String message = "mode=" + mode + ", news=" + rows;
        jobFinisher.finish(jobId, "SUCCESS", syncedAt, message);
        return new NewsService.NewsSyncResult("SUCCESS", message, rows, syncedAt);
    }

    interface SyncBody {
        void run(SyncProgress progress);
    }

    interface JobStarter {
        Long start(Instant startedAt, String mode);
    }

    interface JobFinisher {
        void finish(Long jobId, String status, Instant endedAt, String message);
    }

    static class SyncProgress {
        private int rows;

        void addRows(int rows) {
            this.rows += rows;
        }

        int rows() {
            return rows;
        }
    }
}
