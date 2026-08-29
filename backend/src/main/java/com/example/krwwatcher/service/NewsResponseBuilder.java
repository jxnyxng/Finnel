package com.example.krwwatcher.service;

import java.util.List;

// Builds news list response pagination and freshness metadata.
class NewsResponseBuilder {

    NewsPageRequest normalizePage(int page, int pageSize, int maxPageSize) {
        int normalizedPage = Math.max(1, page);
        int normalizedPageSize = Math.max(1, Math.min(pageSize, maxPageSize));
        int offset = (normalizedPage - 1) * normalizedPageSize;
        return new NewsPageRequest(normalizedPage, normalizedPageSize, offset);
    }

    NewsService.NewsResponse build(
        boolean configured,
        List<NewsService.NewsCategory> categories,
        List<NewsService.NewsArticle> articles,
        NewsPageRequest pageRequest,
        int totalCount,
        NewsFreshnessInfo freshness,
        NewsLatestSyncAttempt latestSyncAttempt
    ) {
        int totalPages = totalCount == 0 ? 0 : (int) Math.ceil((double) totalCount / pageRequest.pageSize());
        return new NewsService.NewsResponse(
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
