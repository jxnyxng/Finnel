package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;

@JsonTest
class DashboardJsonContractTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void serializesIntradayObservedAtAsIsoInstant() throws Exception {
        DashboardService.IntradayTimeSeriesPoint point = new DashboardService.IntradayTimeSeriesPoint(
            Instant.parse("2026-07-21T00:05:00Z"),
            new BigDecimal("1391.0000"),
            new BigDecimal("1392.0000"),
            new BigDecimal("1390.0000"),
            new BigDecimal("1391.2000"),
            Instant.parse("2026-07-21T00:05:30Z")
        );

        String json = objectMapper.writeValueAsString(point);

        assertThat(json).contains("\"observedAt\":\"2026-07-21T00:05:00Z\"");
        assertThat(json).contains("\"open\":1391.0000");
        assertThat(json).contains("\"high\":1392.0000");
        assertThat(json).contains("\"low\":1390.0000");
        assertThat(json).contains("\"fetchedAt\":\"2026-07-21T00:05:30Z\"");
    }

    @Test
    void serializesDomesticIndicatorFreshnessContract() throws Exception {
        DashboardService.DomesticIndicator indicator = new DashboardService.DomesticIndicator(
            "USD_KRW",
            "원/달러 환율",
            "환율 현재 압력",
            new BigDecimal("1391.2000"),
            "KRW",
            LocalDate.of(2026, 7, 21),
            Instant.parse("2026-07-21T00:05:00Z"),
            new BigDecimal("1389.0000"),
            LocalDate.of(2026, 7, 18),
            "Twelve Data:USD/KRW 1min",
            "https://example.com/source",
            Instant.parse("2026-07-21T00:05:30Z"),
            "원화 약세 압력",
            "Twelve Data 1분봉과 일별 저장 환율을 함께 사용합니다.",
            "정상 수집",
            null,
            "FRESH",
            null,
            null,
            Instant.parse("2026-07-21T00:15:00Z"),
            Instant.parse("2026-07-21T00:05:30Z"),
            List.of()
        );

        String json = objectMapper.writeValueAsString(indicator);

        assertThat(json).contains("\"code\":\"USD_KRW\"");
        assertThat(json).contains("\"sourceUrl\":\"https://example.com/source\"");
        assertThat(json).contains("\"freshnessStatus\":\"FRESH\"");
        assertThat(json).contains("\"staleReason\":null");
        assertThat(json).contains("\"freshnessReason\":null");
        assertThat(json).contains("\"expectedNextUpdateAt\":\"2026-07-21T00:15:00Z\"");
        assertThat(json).contains("\"lastSuccessfulFetchedAt\":\"2026-07-21T00:05:30Z\"");
        assertThat(json).contains("\"componentFreshnesses\":[]");
    }
}
