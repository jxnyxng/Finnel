// Builds dashboard dollar-index status records and guards release-date lookup failures.
package com.example.krwwatcher.service;

import java.time.LocalDate;
import java.util.Optional;

import com.example.krwwatcher.domain.DollarIndex;
import com.example.krwwatcher.external.FredClient;

class DashboardDollarIndexStatusProvider {

    private final NextReleaseDateFetcher nextReleaseDateFetcher;

    DashboardDollarIndexStatusProvider(FredClient fredClient) {
        this(fredClient == null ? null : fredClient::fetchNextReleaseDate);
    }

    DashboardDollarIndexStatusProvider(NextReleaseDateFetcher nextReleaseDateFetcher) {
        this.nextReleaseDateFetcher = nextReleaseDateFetcher;
    }

    DashboardService.DollarIndexStatus dollarIndexStatus(DollarIndex latestDollarIndex, String seriesId, LocalDate releaseDateFrom) {
        if (latestDollarIndex == null) {
            return new DashboardService.DollarIndexStatus(null, null, null);
        }
        return new DashboardService.DollarIndexStatus(
            latestDollarIndex.getBaseDate(),
            latestDollarIndex.getFetchedAt(),
            fredNextReleaseDate(seriesId, releaseDateFrom)
        );
    }

    private LocalDate fredNextReleaseDate(String seriesId, LocalDate releaseDateFrom) {
        if (nextReleaseDateFetcher == null) {
            return null;
        }
        try {
            return nextReleaseDateFetcher.fetch(seriesId, releaseDateFrom).orElse(null);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    @FunctionalInterface
    interface NextReleaseDateFetcher {
        Optional<LocalDate> fetch(String seriesId, LocalDate dateFrom);
    }
}
