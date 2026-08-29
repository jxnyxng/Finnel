package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

import com.example.krwwatcher.domain.ExchangeRate;

// Dashboard data freshness policy for staleness labels, thresholds, and aggregation.
class DashboardFreshnessPolicy {

    static final String FRESH = "FRESH";
    static final String STALE = "STALE";
    static final String MISSING = "MISSING";

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final Duration MACRO_COLLECTION_STALE_AFTER = Duration.ofDays(2);

    String statusLabel(DashboardFreshnessInfo freshness) {
        if (MISSING.equals(freshness.freshnessStatus())) {
            return "데이터 없음";
        }
        if (STALE.equals(freshness.freshnessStatus())) {
            return "업데이트 지연";
        }
        return "정상 수집";
    }

    DashboardFreshnessInfo usdKrwFreshness(
        DashboardService.IntradayTimeSeriesPoint latestIntraday,
        ExchangeRate latestDaily,
        LocalDate baseDate,
        BigDecimal value,
        Instant now
    ) {
        if (value == null) {
            return missingFreshness();
        }

        LocalDateTime seoulNow = LocalDateTime.ofInstant(now, SEOUL_ZONE);
        if (latestIntraday != null && UsdKrwIntradaySession.activeSessionStartDate(seoulNow) != null) {
            Instant lastObservedAt = latestIntraday.observedAt();
            Instant expectedNextUpdateAt = lastObservedAt.plus(Duration.ofMinutes(10));
            return now.isAfter(expectedNextUpdateAt)
                ? staleFreshness("USD/KRW 1분봉이 장중 허용 지연 10분을 넘었습니다.", expectedNextUpdateAt, latestIntraday.fetchedAt())
                : freshFreshness(expectedNextUpdateAt, latestIntraday.fetchedAt());
        }

        Instant fetchedAt = latestDaily == null ? null : latestDaily.getFetchedAt();
        return freshnessByBusinessDays("USD/KRW 일별 환율", baseDate, value, fetchedAt, now, 1);
    }

    DashboardFreshnessInfo freshness(String code, LocalDate baseDate, BigDecimal value, Instant fetchedAt, Instant now) {
        if (value == null) {
            return missingFreshness();
        }

        return switch (code) {
            case "US_TREASURY_1MO", "US_TREASURY_3MO", "US_TREASURY_6MO", "US_TREASURY_1Y", "US_TREASURY_2Y",
                "US_TREASURY_3Y", "US_TREASURY_5Y", "US_TREASURY_7Y", "US_10Y_TREASURY",
                "US_TREASURY_20Y", "US_TREASURY_30Y", "SOFR", "SOFR_30D_AVG", "SOFR_90D_AVG",
                "SOFR_180D_AVG", "SOFR_INDEX", "KOFR", "CD_91D", "VIX", "WTI_OIL",
                "GLOBAL_CREDIT_SPREAD_PROXY", "KOREA_CDS" -> freshnessByBusinessDays(code, baseDate, value, fetchedAt, now, 2);
            case "US_POLICY_RATE" -> freshnessByBusinessDays(code, baseDate, value, fetchedAt, now, 2);
            case "RESERVES_TO_SHORT_TERM_DEBT" -> freshnessByMonths(code, baseDate, value, fetchedAt, now, 4);
            default -> freshnessByMonths(code, baseDate, value, fetchedAt, now, 2);
        };
    }

    DashboardFreshnessInfo aggregateFreshness(List<DashboardService.DomesticIndicator> indicators) {
        List<DashboardService.DomesticIndicator> staleIndicators = indicators.stream()
            .filter(indicator -> STALE.equals(indicator.freshnessStatus()))
            .toList();
        if (!staleIndicators.isEmpty()) {
            Instant oldestExpectedUpdate = staleIndicators.stream()
                .map(DashboardService.DomesticIndicator::expectedNextUpdateAt)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);
            Instant latestSuccessfulFetch = indicators.stream()
                .map(DashboardService.DomesticIndicator::lastSuccessfulFetchedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
            return new DashboardFreshnessInfo(
                STALE,
                staleIndicators.get(0).title() + " 등 " + staleIndicators.size() + "개 지표 업데이트가 지연되었습니다.",
                oldestExpectedUpdate,
                latestSuccessfulFetch
            );
        }

        boolean hasFresh = indicators.stream().anyMatch(indicator -> FRESH.equals(indicator.freshnessStatus()));
        Instant nextUpdate = indicators.stream()
            .map(DashboardService.DomesticIndicator::expectedNextUpdateAt)
            .filter(Objects::nonNull)
            .min(Comparator.naturalOrder())
            .orElse(null);
        Instant latestSuccessfulFetch = indicators.stream()
            .map(DashboardService.DomesticIndicator::lastSuccessfulFetchedAt)
            .filter(Objects::nonNull)
            .max(Comparator.naturalOrder())
            .orElse(null);
        return hasFresh ? new DashboardFreshnessInfo(FRESH, null, nextUpdate, latestSuccessfulFetch) : missingFreshness();
    }

    DashboardFreshnessInfo aggregateCalculationFreshness(List<DashboardService.IndicatorComponentFreshness> components) {
        List<DashboardService.IndicatorComponentFreshness> staleComponents = components.stream()
            .filter(component -> STALE.equals(component.freshnessStatus()))
            .toList();
        if (!staleComponents.isEmpty()) {
            Instant latestSuccessfulFetch = components.stream()
                .map(DashboardService.IndicatorComponentFreshness::fetchedAt)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);
            return new DashboardFreshnessInfo(
                STALE,
                staleComponents.get(0).title() + " 기준 원천 업데이트가 지연되었습니다.",
                null,
                latestSuccessfulFetch
            );
        }

        boolean hasMissing = components.stream().anyMatch(component -> MISSING.equals(component.freshnessStatus()));
        if (hasMissing) {
            return missingFreshness();
        }

        Instant oldestSuccessfulFetch = components.stream()
            .map(DashboardService.IndicatorComponentFreshness::fetchedAt)
            .filter(Objects::nonNull)
            .min(Comparator.naturalOrder())
            .orElse(null);
        return new DashboardFreshnessInfo(FRESH, null, null, oldestSuccessfulFetch);
    }

    DashboardFreshnessInfo missingFreshness() {
        return new DashboardFreshnessInfo(MISSING, "저장된 최신 수집값이 없습니다.", null, null);
    }

    DashboardFreshnessInfo freshFreshness(Instant expectedNextUpdateAt, Instant fetchedAt) {
        return new DashboardFreshnessInfo(FRESH, null, expectedNextUpdateAt, fetchedAt);
    }

    DashboardFreshnessInfo staleFreshness(String reason, Instant expectedNextUpdateAt, Instant fetchedAt) {
        return new DashboardFreshnessInfo(STALE, reason, expectedNextUpdateAt, fetchedAt);
    }

    private DashboardFreshnessInfo freshnessByBusinessDays(String label, LocalDate baseDate, BigDecimal value, Instant fetchedAt, Instant now, int allowedBusinessDays) {
        if (value == null || baseDate == null) {
            return missingFreshness();
        }
        if (isRecentlyFetched(fetchedAt, now)) {
            return freshFreshness(nextCollectionCheckAt(fetchedAt), fetchedAt);
        }

        LocalDate expectedDate = addBusinessDays(baseDate, allowedBusinessDays);
        Instant expectedNextUpdateAt = expectedDate.atTime(18, 0).atZone(SEOUL_ZONE).toInstant();
        return now.isAfter(expectedNextUpdateAt)
            ? staleFreshness(label + " 최신 발표 기준일이 허용 지연을 넘었습니다.", expectedNextUpdateAt, fetchedAt)
            : freshFreshness(expectedNextUpdateAt, fetchedAt);
    }

    private DashboardFreshnessInfo freshnessByMonths(String label, LocalDate baseDate, BigDecimal value, Instant fetchedAt, Instant now, int allowedMonths) {
        if (value == null || baseDate == null) {
            return missingFreshness();
        }
        if (isRecentlyFetched(fetchedAt, now)) {
            return freshFreshness(nextCollectionCheckAt(fetchedAt), fetchedAt);
        }

        Instant expectedNextUpdateAt = baseDate.plusMonths(allowedMonths).atTime(18, 0).atZone(SEOUL_ZONE).toInstant();
        return now.isAfter(expectedNextUpdateAt)
            ? staleFreshness(label + " 발표 주기 기준 허용 지연을 넘었습니다.", expectedNextUpdateAt, fetchedAt)
            : freshFreshness(expectedNextUpdateAt, fetchedAt);
    }

    private LocalDate addBusinessDays(LocalDate date, int days) {
        LocalDate cursor = date;
        int added = 0;
        while (added < days) {
            cursor = cursor.plusDays(1);
            if (isWeekday(cursor)) {
                added++;
            }
        }
        return cursor;
    }

    private boolean isRecentlyFetched(Instant fetchedAt, Instant now) {
        return fetchedAt != null && !now.isAfter(fetchedAt.plus(MACRO_COLLECTION_STALE_AFTER));
    }

    private Instant nextCollectionCheckAt(Instant fetchedAt) {
        return fetchedAt == null ? null : fetchedAt.plus(MACRO_COLLECTION_STALE_AFTER);
    }

    private boolean isWeekday(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        return dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY;
    }
}
