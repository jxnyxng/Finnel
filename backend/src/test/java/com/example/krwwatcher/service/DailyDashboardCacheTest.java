package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.example.krwwatcher.config.DashboardCacheProperties;
import org.junit.jupiter.api.Test;

class DailyDashboardCacheTest {

    @Test
    void returnsCachedResponseWithinTtl() {
        DailyDashboardCache cache = new DailyDashboardCache(new DashboardCacheProperties(true, Duration.ofMinutes(1)));
        AtomicInteger loadCount = new AtomicInteger();

        DashboardService.DailyDashboardResponse first = cache.get(() -> response(loadCount.incrementAndGet()));
        DashboardService.DailyDashboardResponse second = cache.get(() -> response(loadCount.incrementAndGet()));

        assertThat(second).isSameAs(first);
        assertThat(loadCount).hasValue(1);
    }

    @Test
    void bypassesCacheWhenDisabled() {
        DailyDashboardCache cache = new DailyDashboardCache(new DashboardCacheProperties(false, Duration.ofMinutes(1)));
        AtomicInteger loadCount = new AtomicInteger();

        DashboardService.DailyDashboardResponse first = cache.get(() -> response(loadCount.incrementAndGet()));
        DashboardService.DailyDashboardResponse second = cache.get(() -> response(loadCount.incrementAndGet()));

        assertThat(second).isNotSameAs(first);
        assertThat(loadCount).hasValue(2);
    }

    @Test
    void loadsOnceWhenInitialConcurrentRequestsArrive() throws Exception {
        DailyDashboardCache cache = new DailyDashboardCache(new DashboardCacheProperties(true, Duration.ofMinutes(1)));
        AtomicInteger loadCount = new AtomicInteger();
        CountDownLatch loaderStarted = new CountDownLatch(1);
        CountDownLatch releaseLoader = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            var first = executor.submit(() -> cache.get(() -> {
                loadCount.incrementAndGet();
                loaderStarted.countDown();
                await(releaseLoader);
                return response(1);
            }));
            assertThat(loaderStarted.await(1, TimeUnit.SECONDS)).isTrue();

            var second = executor.submit(() -> cache.get(() -> response(2)));
            releaseLoader.countDown();

            assertThat(second.get(1, TimeUnit.SECONDS)).isSameAs(first.get(1, TimeUnit.SECONDS));
            assertThat(loadCount).hasValue(1);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void returnsStaleResponseWhileRefreshIsAlreadyRunning() throws Exception {
        DailyDashboardCache cache = new DailyDashboardCache(new DashboardCacheProperties(true, Duration.ofMillis(1)));
        DashboardService.DailyDashboardResponse stale = cache.get(() -> response(1));
        Thread.sleep(5);

        CountDownLatch refreshStarted = new CountDownLatch(1);
        CountDownLatch releaseRefresh = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            var refresh = executor.submit(() -> cache.get(() -> {
                refreshStarted.countDown();
                await(releaseRefresh);
                return response(2);
            }));
            assertThat(refreshStarted.await(1, TimeUnit.SECONDS)).isTrue();

            DashboardService.DailyDashboardResponse duringRefresh = cache.get(() -> response(3));

            assertThat(duringRefresh).isSameAs(stale);
            releaseRefresh.countDown();
            assertThat(refresh.get(1, TimeUnit.SECONDS)).isNotSameAs(stale);
        } finally {
            releaseRefresh.countDown();
            executor.shutdownNow();
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private static DashboardService.DailyDashboardResponse response(int value) {
        return new DashboardService.DailyDashboardResponse(
            LocalDate.of(2026, 1, value),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            null,
            null,
            List.of(),
            List.of(),
            null,
            List.of(),
            List.of(),
            "FRESH",
            null,
            Instant.parse("2026-01-01T00:00:00Z"),
            Instant.parse("2026-01-01T00:00:00Z")
        );
    }
}
