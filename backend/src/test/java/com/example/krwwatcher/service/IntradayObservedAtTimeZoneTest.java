package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.TimeZone;
import java.util.UUID;

import javax.sql.DataSource;

import com.example.krwwatcher.config.ExternalApiProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

class IntradayObservedAtTimeZoneTest {

    private final TimeZone originalTimeZone = TimeZone.getDefault();

    @AfterEach
    void restoreTimeZone() {
        TimeZone.setDefault(originalTimeZone);
    }

    @Test
    void readsTimestampObservedAtAsSeoulLocalTimeUnderUtcJvm() {
        assertIntradayObservedAt("UTC");
    }

    @Test
    void readsTimestampObservedAtAsSeoulLocalTimeUnderSeoulJvm() {
        assertIntradayObservedAt("Asia/Seoul");
    }

    private void assertIntradayObservedAt(String jvmTimeZone) {
        TimeZone.setDefault(TimeZone.getTimeZone(jvmTimeZone));
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource());
        createIntradayTable(jdbcTemplate);
        jdbcTemplate.update(
            """
                INSERT INTO intraday_exchange_rates (observed_at, currency_pair, open_rate, high_rate, low_rate, close_rate, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
            LocalDateTime.of(2026, 7, 21, 9, 5),
            "USD/KRW",
            new BigDecimal("1391.0000"),
            new BigDecimal("1392.0000"),
            new BigDecimal("1390.0000"),
            new BigDecimal("1391.2000"),
            "TWELVE_DATA:time_series:USD/KRW",
            Instant.parse("2026-07-21T00:05:30Z")
        );

        DashboardService dashboardService = new DashboardService(externalApiProperties(), null, null, null, null, jdbcTemplate);

        @SuppressWarnings("unchecked")
        List<DashboardService.IntradayTimeSeriesPoint> series = ReflectionTestUtils.invokeMethod(
            dashboardService,
            "findIntradaySeries",
            LocalDate.of(2026, 7, 21)
        );

        assertThat(series).hasSize(1);
        assertThat(series.get(0).observedAt()).isEqualTo(Instant.parse("2026-07-21T00:05:00Z"));
        assertThat(series.get(0).fetchedAt()).isEqualTo(Instant.parse("2026-07-21T00:05:30Z"));
    }

    private void createIntradayTable(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("""
            CREATE TABLE intraday_exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                observed_at TIMESTAMP NOT NULL,
                currency_pair VARCHAR(20) NOT NULL,
                open_rate DECIMAL(19, 4) NOT NULL,
                high_rate DECIMAL(19, 4) NOT NULL,
                low_rate DECIMAL(19, 4) NOT NULL,
                close_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id)
            )
            """);
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:intraday-time-zone-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        return dataSource;
    }

    private ExternalApiProperties externalApiProperties() {
        return new ExternalApiProperties(
            null,
            null,
            null,
            new ExternalApiProperties.TwelveData("", "", "USD/KRW", "1min", 5000),
            null,
            null,
            null,
            null,
            null
        );
    }
}
