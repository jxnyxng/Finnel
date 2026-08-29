package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

class NewsSyncCoordinatorTest {

    private final AtomicBoolean syncRunning = new AtomicBoolean(false);
    private final NewsSyncCoordinator coordinator = new NewsSyncCoordinator(syncRunning, body -> "clean:" + body);
    private final List<FinishedJob> finishedJobs = new ArrayList<>();

    @Test
    void skipsBeforeStartingJobWhenContentSyncDisabled() {
        NewsService.NewsSyncResult result = coordinator.run(
            "latest",
            false,
            () -> true,
            progress -> progress.addRows(1),
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("SKIPPED_DISABLED");
        assertThat(result.rows()).isZero();
        assertThat(finishedJobs).isEmpty();
        assertThat(syncRunning).isFalse();
    }

    @Test
    void skipsBeforeStartingJobWhenNaverClientIsNotConfigured() {
        NewsService.NewsSyncResult result = coordinator.run(
            "latest",
            true,
            () -> false,
            progress -> progress.addRows(1),
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

        NewsService.NewsSyncResult result = coordinator.run(
            "latest",
            true,
            () -> true,
            progress -> progress.addRows(1),
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("SKIPPED_RUNNING");
        assertThat(result.rows()).isZero();
        assertThat(finishedJobs).isEmpty();
        assertThat(syncRunning).isTrue();
    }

    @Test
    void finishesSuccessfulJobWithAccumulatedRowsAndReleasesRunningFlag() {
        NewsService.NewsSyncResult result = coordinator.run(
            "latest",
            true,
            () -> true,
            progress -> {
                progress.addRows(3);
                progress.addRows(4);
            },
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("SUCCESS");
        assertThat(result.message()).isEqualTo("mode=latest, news=7");
        assertThat(result.rows()).isEqualTo(7);
        assertThat(finishedJobs).containsExactly(new FinishedJob(77L, "SUCCESS", "mode=latest, news=7"));
        assertThat(syncRunning).isFalse();
    }

    @Test
    void mapsNaverHttpErrorWithCompletedRowsAndReleasesRunningFlag() {
        NewsService.NewsSyncResult result = coordinator.run(
            "latest",
            true,
            () -> true,
            progress -> {
                progress.addRows(5);
                throw HttpClientErrorException.create(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Too Many Requests",
                    HttpHeaders.EMPTY,
                    "raw body".getBytes(StandardCharsets.UTF_8),
                    StandardCharsets.UTF_8
                );
            },
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("NAVER_API_ERROR");
        assertThat(result.message()).isEqualTo("네이버 뉴스 API HTTP 429: clean:raw body");
        assertThat(result.rows()).isEqualTo(5);
        assertThat(finishedJobs).containsExactly(new FinishedJob(77L, "FAILED", "네이버 뉴스 API HTTP 429: clean:raw body"));
        assertThat(syncRunning).isFalse();
    }

    @Test
    void mapsRuntimeErrorWithCompletedRowsAndReleasesRunningFlag() {
        NewsService.NewsSyncResult result = coordinator.run(
            "latest",
            true,
            () -> true,
            progress -> {
                progress.addRows(2);
                throw new IllegalStateException("boom");
            },
            this::startJob,
            this::finishJob
        );

        assertThat(result.status()).isEqualTo("NEWS_SYNC_ERROR");
        assertThat(result.message()).isEqualTo("뉴스 수집 실패: IllegalStateException");
        assertThat(result.rows()).isEqualTo(2);
        assertThat(finishedJobs).containsExactly(new FinishedJob(77L, "FAILED", "뉴스 수집 실패: IllegalStateException"));
        assertThat(syncRunning).isFalse();
    }

    private Long startJob(Instant startedAt, String mode) {
        assertThat(startedAt).isNotNull();
        assertThat(mode).isEqualTo("latest");
        return 77L;
    }

    private void finishJob(Long jobId, String status, Instant endedAt, String message) {
        assertThat(endedAt).isNotNull();
        finishedJobs.add(new FinishedJob(jobId, status, message));
    }

    private record FinishedJob(Long jobId, String status, String message) {
    }
}
