package com.example.krwwatcher.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.dashboard.cache")
public record DashboardCacheProperties(
    boolean enabled,
    Duration ttl
) {

    public DashboardCacheProperties {
        if (ttl == null) {
            ttl = Duration.ofSeconds(30);
        }
    }

    public static DashboardCacheProperties defaults() {
        return new DashboardCacheProperties(true, Duration.ofSeconds(30));
    }
}
