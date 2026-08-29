package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

class MarketCurrentExchangeRateCandidateSelectorTest {

    private final MarketCurrentExchangeRateCandidateSelector selector = new MarketCurrentExchangeRateCandidateSelector();

    @Test
    void selectsMissingAndStaleCandidatesInOldestFirstOrder() {
        Instant staleThreshold = Instant.parse("2026-08-29T01:00:00Z");
        TwelveDataExchangeCandidate fresh = candidate("USD/KRW", "USD", Instant.parse("2026-08-29T01:00:00Z"));
        TwelveDataExchangeCandidate older = candidate("JPY/KRW", "JPY(100)", Instant.parse("2026-08-28T22:00:00Z"));
        TwelveDataExchangeCandidate oldest = candidate("EUR/KRW", "EUR", Instant.parse("2026-08-28T21:00:00Z"));
        TwelveDataExchangeCandidate missing = candidate("CNY/KRW", "CNY", null);

        List<TwelveDataExchangeCandidate> selected = selector.select(
            List.of(fresh, older, oldest, missing),
            staleThreshold,
            3
        );

        assertThat(selected).containsExactly(missing, oldest, older);
    }

    @Test
    void respectsMaxUpdates() {
        Instant staleThreshold = Instant.parse("2026-08-29T01:00:00Z");

        List<TwelveDataExchangeCandidate> selected = selector.select(
            List.of(
                candidate("USD/KRW", "USD", null),
                candidate("JPY/KRW", "JPY(100)", Instant.parse("2026-08-28T22:00:00Z")),
                candidate("EUR/KRW", "EUR", Instant.parse("2026-08-28T23:00:00Z"))
            ),
            staleThreshold,
            2
        );

        assertThat(selected)
            .extracting(candidate -> candidate.spec().symbol())
            .containsExactly("USD/KRW", "JPY/KRW");
    }

    private TwelveDataExchangeCandidate candidate(String symbol, String currencyCode, Instant latestFetchedAt) {
        return new TwelveDataExchangeCandidate(
            new TwelveDataExchangeSpec(symbol, currencyCode, currencyCode, BigDecimal.ONE),
            latestFetchedAt
        );
    }
}
