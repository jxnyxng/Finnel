package com.example.krwwatcher.service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

// Selects stale or missing current exchange rates for Twelve Data refresh.
class MarketCurrentExchangeRateCandidateSelector {

    List<TwelveDataExchangeCandidate> select(List<TwelveDataExchangeCandidate> candidates, Instant staleThreshold, int maxUpdates) {
        return candidates.stream()
            .filter(candidate -> candidate.latestFetchedAt() == null || candidate.latestFetchedAt().isBefore(staleThreshold))
            .sorted(Comparator.comparing(
                TwelveDataExchangeCandidate::latestFetchedAt,
                Comparator.nullsFirst(Comparator.naturalOrder())
            ))
            .limit(maxUpdates)
            .toList();
    }
}
