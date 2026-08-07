package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;

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
            new BigDecimal("1391.2000"),
            Instant.parse("2026-07-21T00:05:30Z")
        );

        String json = objectMapper.writeValueAsString(point);

        assertThat(json).contains("\"observedAt\":\"2026-07-21T00:05:00Z\"");
        assertThat(json).contains("\"fetchedAt\":\"2026-07-21T00:05:30Z\"");
    }
}
