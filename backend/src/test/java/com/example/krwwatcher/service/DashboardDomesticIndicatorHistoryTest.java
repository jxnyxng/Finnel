package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class DashboardDomesticIndicatorHistoryTest {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");

    private JdbcTemplate jdbcTemplate;
    private DashboardService dashboardService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
        jdbcTemplate.execute("""
            CREATE TABLE exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                currency_code VARCHAR(10) NOT NULL,
                currency_name VARCHAR(100) NOT NULL,
                deal_bas_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(80) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_exchange_rates_currency_date (currency_code, base_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE intraday_exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                observed_at TIMESTAMP NOT NULL,
                currency_pair VARCHAR(20) NOT NULL,
                open_rate DECIMAL(19, 4) NOT NULL,
                high_rate DECIMAL(19, 4) NOT NULL,
                low_rate DECIMAL(19, 4) NOT NULL,
                close_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(80) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_intraday_exchange_rates_pair_time (currency_pair, observed_at)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE domestic_policy_indicators (
                id BIGINT NOT NULL AUTO_INCREMENT,
                indicator_code VARCHAR(50) NOT NULL,
                title VARCHAR(100) NOT NULL,
                category VARCHAR(50) NOT NULL,
                base_date DATE NOT NULL,
                value DECIMAL(19, 4) NOT NULL,
                unit VARCHAR(30) NOT NULL,
                source VARCHAR(80) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_domestic_policy_indicator_date (indicator_code, base_date)
            )
            """);
        dashboardService = new DashboardService(null, null, null, null, null, jdbcTemplate);
    }

    @Test
    void usdKrwHistoryIncludesLatestIntradayPoint() {
        LocalDate today = LocalDate.now(SEOUL_ZONE);
        LocalDate latestDailyDate = today.minusDays(3);
        LocalDate latestIntradayDate = today.minusDays(1);
        jdbcTemplate.update(
            """
                INSERT INTO exchange_rates (base_date, currency_code, currency_name, deal_bas_rate, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
            latestDailyDate,
            "USD",
            "미국 달러",
            new BigDecimal("1384.3264"),
            "FRED:DEXKOUS",
            Instant.parse("2026-08-24T03:12:34Z")
        );
        jdbcTemplate.update(
            """
                INSERT INTO intraday_exchange_rates (observed_at, currency_pair, open_rate, high_rate, low_rate, close_rate, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
            latestIntradayDate.atTime(13, 15),
            "USD/KRW",
            new BigDecimal("1382.0000"),
            new BigDecimal("1383.0000"),
            new BigDecimal("1381.0000"),
            new BigDecimal("1382.8938"),
            "TWELVE_DATA:exchange_rate:USD/KRW",
            Instant.parse("2026-08-24T04:16:00Z")
        );

        DashboardService.DomesticIndicatorHistoryResponse history = dashboardService.domesticIndicatorHistory("USD_KRW", "3Y");

        assertThat(history.endDate()).isEqualTo(latestIntradayDate);
        assertThat(history.points()).last()
            .extracting(DashboardService.TimeSeriesPoint::baseDate, DashboardService.TimeSeriesPoint::value)
            .containsExactly(latestIntradayDate, new BigDecimal("1382.8938"));
    }

    @Test
    void historyEndDateUsesLastReturnedPointDate() {
        LocalDate latestBaseDate = LocalDate.now(SEOUL_ZONE).minusDays(5);
        jdbcTemplate.update(
            """
                INSERT INTO domestic_policy_indicators (indicator_code, title, category, base_date, value, unit, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
            "CD_91D",
            "CD(91일)",
            "시장 금리",
            latestBaseDate,
            new BigDecimal("2.9500"),
            "PERCENT",
            "ECOS:817Y002/010502000",
            Instant.parse("2026-08-24T03:13:03Z")
        );

        DashboardService.DomesticIndicatorHistoryResponse history = dashboardService.domesticIndicatorHistory("CD_91D", "3Y");

        assertThat(history.endDate()).isEqualTo(latestBaseDate);
        assertThat(history.points()).last()
            .extracting(DashboardService.TimeSeriesPoint::baseDate, DashboardService.TimeSeriesPoint::value)
            .containsExactly(latestBaseDate, new BigDecimal("2.9500"));
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:dashboard-history-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
