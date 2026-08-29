package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;

class GovernmentBriefingSyncCoordinatorTest {

    private final AtomicBoolean syncRunning = new AtomicBoolean(false);
    private final GovernmentBriefingSyncCoordinator coordinator = new GovernmentBriefingSyncCoordinator(syncRunning);
    private final List<FinishedJob> finishedJobs = new ArrayList<>();

    @Test
    void skipsBeforeClientAccessWhenContentSyncDisabled() {
        GovernmentBriefingService.GovernmentBriefingSyncResult result = coordinator.run(
            "latest",
            false,
            () -> {
                throw new AssertionError("client configuration must not be read when content sync is disabled");
            },
            progress -> progress.addRows(1),
            progress -> "briefings=" + progress.rows(),
            (exception, progress) -> "정책브리핑 API 호출 실패: " + exception.getClass().getSimpleName(),
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("SKIPPED_DISABLED");
        assertThat(result.rows()).isZero();
        assertThat(finishedJobs).isEmpty();
        assertThat(syncRunning).isFalse();
    }

    @Test
    void skipsBeforeStartingJobWhenClientIsNotConfigured() {
        GovernmentBriefingService.GovernmentBriefingSyncResult result = coordinator.run(
            "latest",
            true,
            () -> false,
            progress -> progress.addRows(1),
            progress -> "briefings=" + progress.rows(),
            (exception, progress) -> "정책브리핑 API 호출 실패: " + exception.getClass().getSimpleName(),
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("SKIPPED_NOT_CONFIGURED");
        assertThat(result.rows()).isZero();
        assertThat(finishedJobs).isEmpty();
    }

    @Test
    void skipsWhenSyncIsAlreadyRunning() {
        syncRunning.set(true);

        GovernmentBriefingService.GovernmentBriefingSyncResult result = coordinator.run(
            "latest",
            true,
            () -> true,
            progress -> progress.addRows(1),
            progress -> "briefings=" + progress.rows(),
            (exception, progress) -> "정책브리핑 API 호출 실패: " + exception.getClass().getSimpleName(),
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("SKIPPED_RUNNING");
        assertThat(result.rows()).isZero();
        assertThat(finishedJobs).isEmpty();
        assertThat(syncRunning).isTrue();
    }

    @Test
    void finishesSuccessfulJobWithRowsFetchedAndCalls() {
        GovernmentBriefingService.GovernmentBriefingSyncResult result = coordinator.run(
            "backfill months=2",
            true,
            () -> true,
            progress -> {
                progress.addFetched(10);
                progress.addRows(4);
                progress.incrementCalls();
                progress.addFetched(5);
                progress.addRows(2);
                progress.incrementCalls();
            },
            progress -> "briefings=" + progress.rows() + ", fetched=" + progress.fetched() + ", calls=" + progress.calls(),
            (exception, progress) -> "정책브리핑 API 호출 실패: " + exception.getClass().getSimpleName(),
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("SUCCESS");
        assertThat(result.message()).isEqualTo("briefings=6, fetched=15, calls=2");
        assertThat(result.rows()).isEqualTo(6);
        assertThat(finishedJobs).containsExactly(new FinishedJob(77L, "SUCCESS", "briefings=6, fetched=15, calls=2"));
        assertThat(syncRunning).isFalse();
    }

    @Test
    void mapsRuntimeErrorWithProgressAndReleasesRunningFlag() {
        GovernmentBriefingService.GovernmentBriefingSyncResult result = coordinator.run(
            "backfill months=2",
            true,
            () -> true,
            progress -> {
                progress.addFetched(10);
                progress.addRows(4);
                progress.incrementCalls();
                throw new IllegalStateException("boom");
            },
            progress -> "briefings=" + progress.rows() + ", fetched=" + progress.fetched() + ", calls=" + progress.calls(),
            (exception, progress) -> "정책브리핑 API 호출 실패: " + exception.getClass().getSimpleName()
                + ", calls=" + progress.calls() + ", fetched=" + progress.fetched() + ", rows=" + progress.rows(),
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("POLICY_BRIEFING_API_ERROR");
        assertThat(result.message()).isEqualTo("정책브리핑 API 호출 실패: IllegalStateException, calls=1, fetched=10, rows=4");
        assertThat(result.rows()).isEqualTo(4);
        assertThat(finishedJobs).containsExactly(new FinishedJob(77L, "FAILED", "정책브리핑 API 호출 실패: IllegalStateException, calls=1, fetched=10, rows=4"));
        assertThat(syncRunning).isFalse();
    }

    private Long startJob(Instant startedAt, String mode) {
        assertThat(startedAt).isNotNull();
        assertThat(mode).isNotBlank();
        return 77L;
    }

    private void finishJob(Long jobId, String status, Instant endedAt, String message) {
        assertThat(endedAt).isNotNull();
        finishedJobs.add(new FinishedJob(jobId, status, message));
    }

    private record FinishedJob(Long jobId, String status, String message) {
    }
}
