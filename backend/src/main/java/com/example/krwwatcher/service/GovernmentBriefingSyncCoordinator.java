package com.example.krwwatcher.service;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BiFunction;
import java.util.function.BooleanSupplier;
import java.util.function.Function;

// Coordinates government briefing sync locking, job status recording, and result mapping.
class GovernmentBriefingSyncCoordinator {

    private final AtomicBoolean syncRunning;

    GovernmentBriefingSyncCoordinator(AtomicBoolean syncRunning) {
        this.syncRunning = syncRunning;
    }

    GovernmentBriefingService.GovernmentBriefingSyncResult run(
        String mode,
        boolean contentSyncEnabled,
        BooleanSupplier clientConfigured,
        SyncBody syncBody,
        Function<SyncProgress, String> successMessage,
        BiFunction<RuntimeException, SyncProgress, String> failureMessage,
        JobStarter jobStarter,
        JobFinisher jobFinisher
    ) {
        if (!contentSyncEnabled) {
            return new GovernmentBriefingService.GovernmentBriefingSyncResult("SKIPPED_DISABLED", "콘텐츠 수집이 비활성화되어 있습니다.", 0, Instant.now());
        }

        if (!clientConfigured.getAsBoolean()) {
            return new GovernmentBriefingService.GovernmentBriefingSyncResult("SKIPPED_NOT_CONFIGURED", "POLICY_BRIEFING_API_KEY 설정이 필요합니다.", 0, Instant.now());
        }

        if (!syncRunning.compareAndSet(false, true)) {
            return new GovernmentBriefingService.GovernmentBriefingSyncResult("SKIPPED_RUNNING", "정부 브리핑 수집이 이미 진행 중입니다.", 0, Instant.now());
        }

        Instant startedAt = Instant.now();
        Long jobId = jobStarter.start(startedAt, mode);
        SyncProgress progress = new SyncProgress();
        try {
            syncBody.run(progress);
        } catch (RuntimeException exception) {
            Instant endedAt = Instant.now();
            String message = failureMessage.apply(exception, progress);
            jobFinisher.finish(jobId, "FAILED", endedAt, message);
            return new GovernmentBriefingService.GovernmentBriefingSyncResult(
                "POLICY_BRIEFING_API_ERROR",
                message,
                progress.rows(),
                endedAt
            );
        } finally {
            syncRunning.set(false);
        }

        Instant syncedAt = Instant.now();
        String message = successMessage.apply(progress);
        jobFinisher.finish(jobId, "SUCCESS", syncedAt, message);
        return new GovernmentBriefingService.GovernmentBriefingSyncResult("SUCCESS", message, progress.rows(), syncedAt);
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
        private int fetched;
        private int calls;

        void addRows(int rows) {
            this.rows += rows;
        }

        void addFetched(int fetched) {
            this.fetched += fetched;
        }

        void incrementCalls() {
            calls++;
        }

        int rows() {
            return rows;
        }

        int fetched() {
            return fetched;
        }

        int calls() {
            return calls;
        }
    }
}
