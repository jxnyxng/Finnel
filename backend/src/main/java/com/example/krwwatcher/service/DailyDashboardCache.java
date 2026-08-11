package com.example.krwwatcher.service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

import com.example.krwwatcher.config.DashboardCacheProperties;

final class DailyDashboardCache {

    private final DashboardCacheProperties properties;
    private final AtomicReference<CachedDailyDashboard> cache = new AtomicReference<>();
    private final ReentrantLock refreshLock = new ReentrantLock();

    DailyDashboardCache(DashboardCacheProperties properties) {
        this.properties = properties == null ? DashboardCacheProperties.defaults() : properties;
    }

    DashboardService.DailyDashboardResponse get(Supplier<DashboardService.DailyDashboardResponse> loader) {
        if (!isEnabled()) {
            return loader.get();
        }

        Instant now = Instant.now();
        CachedDailyDashboard cached = cache.get();
        if (cached != null && cached.isFresh(now, properties.ttl())) {
            return cached.response();
        }

        if (cached != null && !refreshLock.tryLock()) {
            return cached.response();
        }

        boolean locked = cached != null;
        if (!locked) {
            refreshLock.lock();
            locked = true;
        }

        try {
            CachedDailyDashboard current = cache.get();
            now = Instant.now();
            if (current != null && current.isFresh(now, properties.ttl())) {
                return current.response();
            }

            DashboardService.DailyDashboardResponse response = loader.get();
            cache.set(new CachedDailyDashboard(response, Instant.now()));
            return response;
        } finally {
            if (locked) {
                refreshLock.unlock();
            }
        }
    }

    private boolean isEnabled() {
        return properties.enabled() && !properties.ttl().isNegative() && !properties.ttl().isZero();
    }

    private record CachedDailyDashboard(
        DashboardService.DailyDashboardResponse response,
        Instant cachedAt
    ) {

        private boolean isFresh(Instant now, Duration ttl) {
            return cachedAt.plus(ttl).isAfter(now);
        }
    }
}
