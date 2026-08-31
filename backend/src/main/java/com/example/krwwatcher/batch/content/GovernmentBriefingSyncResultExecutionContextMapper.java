package com.example.krwwatcher.batch.content;

import java.time.Instant;

import com.example.krwwatcher.service.GovernmentBriefingService;
import org.springframework.batch.item.ExecutionContext;

final class GovernmentBriefingSyncResultExecutionContextMapper {

    private static final String PREFIX = "sync.";

    private GovernmentBriefingSyncResultExecutionContextMapper() {
    }

    static void put(ExecutionContext context, GovernmentBriefingService.GovernmentBriefingSyncResult result) {
        context.putString(PREFIX + "status", result.status());
        context.putString(PREFIX + "message", result.message());
        context.putInt(PREFIX + "rows", result.rows());
        if (result.syncedAt() != null) {
            context.putString(PREFIX + "syncedAt", result.syncedAt().toString());
        }
    }

    static boolean containsResult(ExecutionContext context) {
        return context.containsKey(PREFIX + "status");
    }

    static GovernmentBriefingService.GovernmentBriefingSyncResult get(ExecutionContext context) {
        return new GovernmentBriefingService.GovernmentBriefingSyncResult(
            context.getString(PREFIX + "status"),
            context.getString(PREFIX + "message", ""),
            context.getInt(PREFIX + "rows", 0),
            instantOrNull(context, PREFIX + "syncedAt")
        );
    }

    private static Instant instantOrNull(ExecutionContext context, String key) {
        return context.containsKey(key) ? Instant.parse(context.getString(key)) : null;
    }
}
