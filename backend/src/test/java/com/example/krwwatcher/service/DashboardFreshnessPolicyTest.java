package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

class DashboardFreshnessPolicyTest {

    private final DashboardFreshnessPolicy policy = new DashboardFreshnessPolicy();

    @Test
    void recentlyFetchedOldMonthlyValueIsFreshUntilNextCollectionCheck() {
        Instant fetchedAt = Instant.parse("2026-08-28T00:00:00Z");

        DashboardFreshnessInfo freshness = policy.freshness(
            "FISCAL_BALANCE",
            LocalDate.of(2026, 1, 31),
            new BigDecimal("-10.2500"),
            fetchedAt,
            Instant.parse("2026-08-29T00:00:00Z")
        );

        assertThat(freshness.freshnessStatus()).isEqualTo("FRESH");
        assertThat(freshness.staleReason()).isNull();
        assertThat(freshness.expectedNextUpdateAt()).isEqualTo(Instant.parse("2026-08-30T00:00:00Z"));
        assertThat(freshness.lastSuccessfulFetchedAt()).isEqualTo(fetchedAt);
        assertThat(policy.statusLabel(freshness)).isEqualTo("정상 수집");
    }

    @Test
    void oldMonthlyValueBeyondAllowedDelayIsStale() {
        DashboardFreshnessInfo freshness = policy.freshness(
            "FISCAL_BALANCE",
            LocalDate.of(2026, 1, 31),
            new BigDecimal("-10.2500"),
            Instant.parse("2026-02-01T00:00:00Z"),
            Instant.parse("2026-04-01T10:00:01Z")
        );

        assertThat(freshness.freshnessStatus()).isEqualTo("STALE");
        assertThat(freshness.staleReason()).isEqualTo("FISCAL_BALANCE 발표 주기 기준 허용 지연을 넘었습니다.");
        assertThat(freshness.expectedNextUpdateAt()).isEqualTo(Instant.parse("2026-03-31T09:00:00Z"));
        assertThat(freshness.lastSuccessfulFetchedAt()).isEqualTo(Instant.parse("2026-02-01T00:00:00Z"));
        assertThat(policy.statusLabel(freshness)).isEqualTo("업데이트 지연");
    }

    @Test
    void aggregateFreshnessReportsFirstStaleIndicatorAndLatestFetch() {
        DashboardService.DomesticIndicator stale = indicator(
            "FISCAL_BALANCE",
            "재정수지",
            "STALE",
            Instant.parse("2026-08-20T09:00:00Z"),
            Instant.parse("2026-08-21T00:00:00Z")
        );
        DashboardService.DomesticIndicator fresh = indicator(
            "GOVERNMENT_DEBT",
            "국가채무",
            "FRESH",
            Instant.parse("2026-08-22T09:00:00Z"),
            Instant.parse("2026-08-23T00:00:00Z")
        );

        DashboardFreshnessInfo freshness = policy.aggregateFreshness(List.of(stale, fresh));

        assertThat(freshness.freshnessStatus()).isEqualTo("STALE");
        assertThat(freshness.staleReason()).isEqualTo("재정수지 등 1개 지표 업데이트가 지연되었습니다.");
        assertThat(freshness.expectedNextUpdateAt()).isEqualTo(Instant.parse("2026-08-20T09:00:00Z"));
        assertThat(freshness.lastSuccessfulFetchedAt()).isEqualTo(Instant.parse("2026-08-23T00:00:00Z"));
    }

    private DashboardService.DomesticIndicator indicator(
        String code,
        String title,
        String freshnessStatus,
        Instant expectedNextUpdateAt,
        Instant lastSuccessfulFetchedAt
    ) {
        return new DashboardService.DomesticIndicator(
            code,
            title,
            "재정 정책",
            BigDecimal.ONE,
            "KRW_TRILLION",
            LocalDate.of(2026, 1, 31),
            null,
            null,
            "OPENFISCAL:BudgetBalance",
            null,
            "중립",
            null,
            "정상 수집",
            null,
            freshnessStatus,
            null,
            expectedNextUpdateAt,
            lastSuccessfulFetchedAt
        );
    }
}
