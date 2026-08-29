package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MarketMacroIndicatorDaoTest {

    private JdbcTemplate jdbcTemplate;
    private MarketMacroIndicatorDao dao;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
        jdbcTemplate.execute("""
            CREATE TABLE dollar_indexes (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                series_id VARCHAR(50) NOT NULL,
                value DECIMAL(19, 6) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_dollar_indexes_series_date (series_id, base_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE interest_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                country_code VARCHAR(10) NOT NULL,
                rate_type VARCHAR(50) NOT NULL,
                rate_value DECIMAL(19, 4) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_interest_rates_country_type_date (country_code, rate_type, base_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE foreign_reserves (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                amount_usd_million DECIMAL(19, 4) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_foreign_reserves_base_date (base_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE effective_exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                area_code VARCHAR(10) NOT NULL,
                area_name VARCHAR(100) NOT NULL,
                index_type VARCHAR(10) NOT NULL,
                basket_type VARCHAR(10) NOT NULL,
                value DECIMAL(19, 6) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id)
            )
            """);
        dao = new MarketMacroIndicatorDao(jdbcTemplate);
    }

    @Test
    void upsertsDollarIndexAndFindsLatestDate() {
        LocalDate baseDate = LocalDate.of(2026, 7, 20);

        dao.upsertDollarIndex(baseDate, "DTWEXBGS", new BigDecimal("120.100000"), "FRED", Instant.parse("2026-07-20T00:00:00Z"));
        dao.upsertDollarIndex(baseDate, "DTWEXBGS", new BigDecimal("121.200000"), "FRED", Instant.parse("2026-07-21T00:00:00Z"));

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM dollar_indexes", Integer.class);
        BigDecimal storedValue = jdbcTemplate.queryForObject("SELECT value FROM dollar_indexes WHERE series_id = 'DTWEXBGS'", BigDecimal.class);

        assertThat(count).isEqualTo(1);
        assertThat(storedValue).isEqualByComparingTo("121.200000");
        assertThat(dao.findLatestDollarIndexDate("DTWEXBGS")).isEqualTo(baseDate);
    }

    @Test
    void upsertsInterestRateAndEvaluatesRecentFetchAndCoverage() {
        dao.upsertInterestRate(LocalDate.of(2026, 7, 20), "US", "POLICY_RATE", new BigDecimal("5.5000"), "FRED:FEDFUNDS", Instant.parse("2026-08-29T00:00:00Z"));
        dao.upsertInterestRate(LocalDate.of(2026, 7, 20), "US", "POLICY_RATE", new BigDecimal("5.2500"), "FRED:FEDFUNDS", Instant.parse("2026-08-30T00:00:00Z"));

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM interest_rates", Integer.class);
        BigDecimal storedValue = jdbcTemplate.queryForObject("SELECT rate_value FROM interest_rates WHERE country_code = 'US'", BigDecimal.class);

        assertThat(count).isEqualTo(1);
        assertThat(storedValue).isEqualByComparingTo("5.2500");
        assertThat(dao.findLatestInterestRateDate("US", "POLICY_RATE")).isEqualTo(LocalDate.of(2026, 7, 20));
        assertThat(dao.findEarliestInterestRateDate("US", "POLICY_RATE")).isEqualTo(LocalDate.of(2026, 7, 20));
        assertThat(dao.hasRecentInterestRateFetch("US", "POLICY_RATE", Instant.parse("2026-08-29T12:00:00Z"))).isTrue();
        assertThat(dao.hasInterestRateCoverage("US", "POLICY_RATE", LocalDate.of(2026, 6, 10))).isTrue();
        assertThat(dao.hasInterestRateCoverage("US", "POLICY_RATE", LocalDate.of(2026, 6, 1))).isFalse();
    }

    @Test
    void upsertsForeignReserveAndGuardsRecentTableFetch() {
        dao.upsertForeignReserve(LocalDate.of(2026, 7, 31), new BigDecimal("410000.0000"), "ECOS:732Y001", Instant.parse("2026-08-29T00:00:00Z"));

        BigDecimal storedValue = jdbcTemplate.queryForObject("SELECT amount_usd_million FROM foreign_reserves", BigDecimal.class);

        assertThat(storedValue).isEqualByComparingTo("410000.0000");
        assertThat(dao.hasRecentTableFetch("foreign_reserves", Instant.parse("2026-08-28T00:00:00Z"))).isTrue();
        assertThat(dao.hasRecentTableFetch("foreign_reserves", Instant.parse("2026-08-30T00:00:00Z"))).isFalse();
        assertThatThrownBy(() -> dao.hasRecentTableFetch("batch_job_runs", Instant.parse("2026-08-28T00:00:00Z")))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unsupported freshness table");
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:market-macro-indicator-dao-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
