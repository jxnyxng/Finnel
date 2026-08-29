// Tests for dashboard dollar-index status assembly.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

import com.example.krwwatcher.domain.DollarIndex;
import org.junit.jupiter.api.Test;

class DashboardDollarIndexStatusProviderTest {

    @Test
    void returnsEmptyStatusWhenLatestDollarIndexIsMissing() {
        DashboardDollarIndexStatusProvider provider = new DashboardDollarIndexStatusProvider((DashboardDollarIndexStatusProvider.NextReleaseDateFetcher) null);

        DashboardService.DollarIndexStatus status = provider.dollarIndexStatus(null, "DTWEXBGS", LocalDate.of(2026, 8, 29));

        assertThat(status.latestBaseDate()).isNull();
        assertThat(status.fetchedAt()).isNull();
        assertThat(status.nextReleaseDate()).isNull();
    }

    @Test
    void includesNextReleaseDateWhenFetcherReturnsIt() {
        DollarIndex latest = dollarIndex();
        DashboardDollarIndexStatusProvider provider = new DashboardDollarIndexStatusProvider(
            (seriesId, dateFrom) -> Optional.of(LocalDate.of(2026, 9, 1))
        );

        DashboardService.DollarIndexStatus status = provider.dollarIndexStatus(latest, "DTWEXBGS", LocalDate.of(2026, 8, 29));

        assertThat(status.latestBaseDate()).isEqualTo(LocalDate.of(2026, 8, 28));
        assertThat(status.fetchedAt()).isEqualTo(Instant.parse("2026-08-28T00:00:00Z"));
        assertThat(status.nextReleaseDate()).isEqualTo(LocalDate.of(2026, 9, 1));
    }

    @Test
    void keepsStatusAndOmitsNextReleaseDateWhenFetcherFails() {
        DollarIndex latest = dollarIndex();
        DashboardDollarIndexStatusProvider provider = new DashboardDollarIndexStatusProvider((seriesId, dateFrom) -> {
            throw new IllegalStateException("remote error");
        });

        DashboardService.DollarIndexStatus status = provider.dollarIndexStatus(latest, "DTWEXBGS", LocalDate.of(2026, 8, 29));

        assertThat(status.latestBaseDate()).isEqualTo(LocalDate.of(2026, 8, 28));
        assertThat(status.fetchedAt()).isEqualTo(Instant.parse("2026-08-28T00:00:00Z"));
        assertThat(status.nextReleaseDate()).isNull();
    }

    private DollarIndex dollarIndex() {
        return new DollarIndex(
            LocalDate.of(2026, 8, 28),
            "DTWEXBGS",
            new BigDecimal("123.4500"),
            "FRED",
            Instant.parse("2026-08-28T00:00:00Z")
        );
    }
}
