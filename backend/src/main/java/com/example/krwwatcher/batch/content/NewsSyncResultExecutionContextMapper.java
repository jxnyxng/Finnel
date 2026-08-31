package com.example.krwwatcher.batch.content;

import java.time.Instant;

import com.example.krwwatcher.service.NewsService;
import org.springframework.batch.item.ExecutionContext;

final class NewsSyncResultExecutionContextMapper {

    private static final String PREFIX = "sync.";

    private NewsSyncResultExecutionContextMapper() {
    }

    static void put(ExecutionContext context, NewsService.NewsSyncResult result) {
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

    static NewsService.NewsSyncResult get(ExecutionContext context) {
        return new NewsService.NewsSyncResult(
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
