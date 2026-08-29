package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.NavigableMap;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MarketExchangeRateDaoTest {

    private JdbcTemplate jdbcTemplate;
    private MarketExchangeRateDao dao;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
        jdbcTemplate.execute("""
            CREATE TABLE exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                currency_code VARCHAR(20) NOT NULL,
                currency_name VARCHAR(100) NOT NULL,
                deal_bas_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(80) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_exchange_rates_currency_date (currency_code, base_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE current_exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                currency_code VARCHAR(20) NOT NULL,
                currency_name VARCHAR(100) NOT NULL,
                deal_bas_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(80) NOT NULL,
                observed_at TIMESTAMP NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_current_exchange_rates_currency (currency_code)
            )
            """);
        dao = new MarketExchangeRateDao(jdbcTemplate);
    }

    @Test
    void upsertsDailyExchangeRateByCurrencyAndBaseDate() {
        LocalDate baseDate = LocalDate.of(2026, 7, 20);

        dao.upsertExchangeRate(baseDate, "USD", "US Dollar", new BigDecimal("1388.3400"), "FRED:DEXKOUS", Instant.parse("2026-07-20T01:00:00Z"));
        dao.upsertExchangeRate(baseDate, "USD", "US Dollar", new BigDecimal("1390.1200"), "KOREAEXIM", Instant.parse("2026-07-20T02:00:00Z"));

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM exchange_rates", Integer.class);
        MarketDataLatestExchangeRate latest = dao.findLatestDailyExchangeRate("USD");

        assertThat(count).isEqualTo(1);
        assertThat(latest.baseDate()).isEqualTo(baseDate);
        assertThat(latest.rate()).isEqualByComparingTo("1390.1200");
        assertThat(dao.findLatestDailyExchangeRateDate("USD")).isEqualTo(baseDate);
        assertThat(dao.findEarliestDailyExchangeRateDate("USD")).isEqualTo(baseDate);
    }

    @Test
    void upsertsCurrentExchangeRateByCurrencyAndUsesObservedAtAsFetchedAt() {
        LocalDate baseDate = LocalDate.of(2026, 7, 20);
        Instant firstObservedAt = Instant.parse("2026-07-20T01:00:00Z");
        Instant secondObservedAt = Instant.parse("2026-07-20T01:05:00Z");

        dao.upsertCurrentExchangeRate(baseDate, "EUR", "Euro", new BigDecimal("1600.0000"), "TWELVE_DATA:exchange_rate:EUR/KRW", firstObservedAt);
        dao.upsertCurrentExchangeRate(baseDate, "EUR", "Euro", new BigDecimal("1601.5000"), "TWELVE_DATA:exchange_rate:EUR/KRW", secondObservedAt);

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM current_exchange_rates", Integer.class);
        BigDecimal storedRate = jdbcTemplate.queryForObject("SELECT deal_bas_rate FROM current_exchange_rates WHERE currency_code = 'EUR'", BigDecimal.class);

        assertThat(count).isEqualTo(1);
        assertThat(storedRate).isEqualByComparingTo("1601.5000");
        assertThat(dao.findLatestCurrentExchangeRateFetch("EUR")).isEqualTo(secondObservedAt);
        assertThat(dao.hasAnyCurrentForeignExchangeRate()).isTrue();
    }

    @Test
    void returnsOrderedDailyExchangeRateMapAndUsdDateWindow() {
        dao.upsertExchangeRate(LocalDate.of(2026, 7, 18), "USD", "US Dollar", new BigDecimal("1387.0000"), "FRED:DEXKOUS", Instant.parse("2026-07-18T01:00:00Z"));
        dao.upsertExchangeRate(LocalDate.of(2026, 7, 19), "USD", "US Dollar", new BigDecimal("1388.0000"), "FRED:DEXKOUS", Instant.parse("2026-07-19T01:00:00Z"));
        dao.upsertExchangeRate(LocalDate.of(2026, 7, 20), "USD", "US Dollar", new BigDecimal("1389.0000"), "FRED:DEXKOUS", Instant.parse("2026-07-20T01:00:00Z"));
        dao.upsertExchangeRate(LocalDate.of(2026, 7, 20), "EUR", "Euro", new BigDecimal("1600.0000"), "FRED:DEXUSEU", Instant.parse("2026-07-20T01:00:00Z"));

        NavigableMap<LocalDate, BigDecimal> rates = dao.findDailyExchangeRateMap("USD", LocalDate.of(2026, 7, 19));

        assertThat(rates).containsOnlyKeys(LocalDate.of(2026, 7, 19), LocalDate.of(2026, 7, 20));
        assertThat(rates.firstEntry().getValue()).isEqualByComparingTo("1388.0000");
        assertThat(dao.findDailyUsdKrwDates(LocalDate.of(2026, 7, 19), LocalDate.of(2026, 7, 20)))
            .containsExactlyInAnyOrder(LocalDate.of(2026, 7, 19), LocalDate.of(2026, 7, 20));
    }

    @Test
    void checksMajorExchangeRateCoverageForDate() {
        LocalDate baseDate = LocalDate.of(2026, 7, 20);
        dao.upsertExchangeRate(baseDate, "USD", "US Dollar", BigDecimal.ONE, "KOREAEXIM", Instant.parse("2026-07-20T01:00:00Z"));
        dao.upsertExchangeRate(baseDate, "JPY(100)", "Japanese Yen", BigDecimal.ONE, "KOREAEXIM", Instant.parse("2026-07-20T01:00:00Z"));
        dao.upsertExchangeRate(baseDate, "EUR", "Euro", BigDecimal.ONE, "KOREAEXIM", Instant.parse("2026-07-20T01:00:00Z"));

        assertThat(dao.hasMajorExchangeRateCoverageForDate(baseDate, 3)).isTrue();
        assertThat(dao.hasMajorExchangeRateCoverageForDate(baseDate, 4)).isFalse();
        assertThat(dao.hasMajorExchangeRateCoverageForDate(baseDate.plusDays(1), 1)).isFalse();
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:market-exchange-rate-dao-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
