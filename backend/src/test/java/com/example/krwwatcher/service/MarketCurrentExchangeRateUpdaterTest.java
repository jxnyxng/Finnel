package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;

import javax.sql.DataSource;

import com.example.krwwatcher.external.TwelveDataClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MarketCurrentExchangeRateUpdaterTest {

    private JdbcTemplate jdbcTemplate;
    private MarketCurrentExchangeRateUpdater updater;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
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
        updater = new MarketCurrentExchangeRateUpdater(
            new MarketExchangeRateDao(jdbcTemplate),
            ZoneId.of("Asia/Seoul")
        );
    }

    @Test
    void upsertsCurrentExchangeRateFromTwelveDataPayload() {
        TwelveDataExchangeSpec spec = new TwelveDataExchangeSpec("JPY/KRW", "JPY(100)", "Japanese Yen", BigDecimal.valueOf(100));
        TwelveDataClient.CurrentExchangeRatePayload payload = new TwelveDataClient.CurrentExchangeRatePayload(
            "JPY/KRW",
            new BigDecimal("9.123456"),
            Instant.parse("2026-08-29T01:23:45Z")
        );

        int rows = updater.upsert(spec, payload);

        assertThat(rows).isEqualTo(1);
        String stored = jdbcTemplate.queryForObject(
            """
                SELECT CONCAT(currency_code, '|', currency_name, '|', deal_bas_rate, '|', source, '|', base_date)
                FROM current_exchange_rates
                """,
            String.class
        );
        assertThat(stored).isEqualTo("JPY(100)|Japanese Yen|912.3456|TWELVE_DATA:exchange_rate:JPY/KRW|2026-08-29");
        assertThat(jdbcTemplate.queryForObject("SELECT observed_at FROM current_exchange_rates", java.sql.Timestamp.class).toInstant())
            .isEqualTo(Instant.parse("2026-08-29T01:23:45Z"));
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:market-current-exchange-updater-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
