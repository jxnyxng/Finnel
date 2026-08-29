package com.example.krwwatcher.service;

import java.util.List;

// Builds government briefing list response pagination and freshness metadata.
class GovernmentBriefingResponseBuilder {

    GovernmentBriefingPageRequest normalizePage(int page, int pageSize, int maxPageSize) {
        int normalizedPage = Math.max(1, page);
        int normalizedPageSize = Math.max(1, Math.min(pageSize, maxPageSize));
        int offset = (normalizedPage - 1) * normalizedPageSize;
        return new GovernmentBriefingPageRequest(normalizedPage, normalizedPageSize, offset);
    }

    GovernmentBriefingService.GovernmentBriefingResponse build(
        boolean configured,
        List<GovernmentBriefingService.GovernmentBriefingCategory> categories,
        List<GovernmentBriefingService.GovernmentBriefingArticle> articles,
        GovernmentBriefingPageRequest pageRequest,
        int totalCount,
        GovernmentBriefingService.FreshnessInfo freshness,
        GovernmentBriefingService.LatestSyncAttempt latestSyncAttempt
    ) {
        int totalPages = totalCount == 0 ? 0 : (int) Math.ceil((double) totalCount / pageRequest.pageSize());
        return new GovernmentBriefingService.GovernmentBriefingResponse(
            configured,
            categories,
            articles,
            pageRequest.page(),
            pageRequest.pageSize(),
            totalCount,
            totalPages,
            freshness.freshnessStatus(),
            freshness.staleReason(),
            freshness.expectedNextUpdateAt(),
            freshness.lastSuccessfulFetchedAt(),
            latestSyncAttempt == null ? null : latestSyncAttempt.status(),
            latestSyncAttempt == null ? null : latestSyncAttempt.startedAt(),
            latestSyncAttempt == null ? null : latestSyncAttempt.endedAt()
        );
    }
}
