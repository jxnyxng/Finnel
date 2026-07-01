package com.example.krwwatcher.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.sync")
public record SyncProperties(
    MarketData marketData
) {

    public record MarketData(
        boolean enabled,
        Duration manualCooldown,
        String cron,
        String zone,
        Duration intradayCooldown,
        String intradayCron,
        Duration dailyBackfillCooldown,
        String dailyBackfillCron
    ) {
    }
}
