package com.example.krwwatcher.batch.market;

import java.time.Instant;

import com.example.krwwatcher.service.MarketDataSyncService;
import org.springframework.batch.item.ExecutionContext;

final class MarketSyncResultExecutionContextMapper {

    private static final String PREFIX = "sync.";

    private MarketSyncResultExecutionContextMapper() {
    }

    static void put(ExecutionContext context, MarketDataSyncService.SyncResult result) {
        context.putInt(PREFIX + "exchangeRateRows", result.exchangeRateRows());
        context.putInt(PREFIX + "intradayExchangeRateRows", result.intradayExchangeRateRows());
        context.putInt(PREFIX + "dollarIndexRows", result.dollarIndexRows());
        context.putInt(PREFIX + "currencyStrengthRows", result.currencyStrengthRows());
        context.putInt(PREFIX + "usPolicyRateRows", result.usPolicyRateRows());
        context.putInt(PREFIX + "krPolicyRateRows", result.krPolicyRateRows());
        context.putInt(PREFIX + "foreignReserveRows", result.foreignReserveRows());
        context.putInt(PREFIX + "domesticPolicyRows", result.domesticPolicyRows());
        context.putString(PREFIX + "status", result.status());
        context.putString(PREFIX + "message", result.message());
        context.putString(PREFIX + "trigger", result.trigger());
        if (result.startedAt() != null) {
            context.putString(PREFIX + "startedAt", result.startedAt().toString());
        }
        if (result.nextAllowedAt() != null) {
            context.putString(PREFIX + "nextAllowedAt", result.nextAllowedAt().toString());
        }
        context.putLong(PREFIX + "remainingCooldownSeconds", result.remainingCooldownSeconds());
    }

    static boolean containsResult(ExecutionContext context) {
        return context.containsKey(PREFIX + "status");
    }

    static MarketDataSyncService.SyncResult get(ExecutionContext context) {
        return new MarketDataSyncService.SyncResult(
            context.getInt(PREFIX + "exchangeRateRows", 0),
            context.getInt(PREFIX + "intradayExchangeRateRows", 0),
            context.getInt(PREFIX + "dollarIndexRows", 0),
            context.getInt(PREFIX + "currencyStrengthRows", 0),
            context.getInt(PREFIX + "usPolicyRateRows", 0),
            context.getInt(PREFIX + "krPolicyRateRows", 0),
            context.getInt(PREFIX + "foreignReserveRows", 0),
            context.getInt(PREFIX + "domesticPolicyRows", 0),
            context.getString(PREFIX + "status"),
            context.getString(PREFIX + "message", ""),
            context.getString(PREFIX + "trigger", "MANUAL"),
            instantOrNull(context, PREFIX + "startedAt"),
            instantOrNull(context, PREFIX + "nextAllowedAt"),
            context.getLong(PREFIX + "remainingCooldownSeconds", 0)
        );
    }

    private static Instant instantOrNull(ExecutionContext context, String key) {
        return context.containsKey(key) ? Instant.parse(context.getString(key)) : null;
    }
}
