package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.NavigableMap;
import java.util.Objects;
import java.util.TreeMap;

import org.springframework.jdbc.core.JdbcTemplate;

// Handles exchange_rates and current_exchange_rates persistence for market data sync.
class MarketExchangeRateDao {

    private final JdbcTemplate jdbcTemplate;

    MarketExchangeRateDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    int upsertExchangeRate(LocalDate baseDate, String currencyCode, String currencyName, BigDecimal rate, String source, Instant fetchedAt) {
        return jdbcTemplate.update("""
                INSERT INTO exchange_rates (base_date, currency_code, currency_name, deal_bas_rate, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    currency_name = VALUES(currency_name),
                    deal_bas_rate = VALUES(deal_bas_rate),
                    source = VALUES(source),
                    fetched_at = VALUES(fetched_at)
                """,
            baseDate,
            currencyCode,
            currencyName,
            rate,
            source,
            fetchedAt
        );
    }

    int upsertCurrentExchangeRate(LocalDate baseDate, String currencyCode, String currencyName, BigDecimal rate, String source, Instant observedAt) {
        return jdbcTemplate.update("""
                INSERT INTO current_exchange_rates (base_date, currency_code, currency_name, deal_bas_rate, source, observed_at, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    base_date = VALUES(base_date),
                    currency_name = VALUES(currency_name),
                    deal_bas_rate = VALUES(deal_bas_rate),
                    source = VALUES(source),
                    observed_at = VALUES(observed_at),
                    fetched_at = VALUES(fetched_at)
                """,
            baseDate,
            currencyCode,
            currencyName,
            rate,
            source,
            observedAt,
            observedAt
        );
    }

    Instant findLatestCurrentExchangeRateFetch(String currencyCode) {
        return jdbcTemplate.query(
            """
                SELECT MAX(fetched_at)
                FROM current_exchange_rates
                WHERE currency_code = ?
                """,
            (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toInstant(),
            currencyCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    boolean hasAnyCurrentForeignExchangeRate() {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM current_exchange_rates
                WHERE currency_code <> 'USD'
                """,
            Integer.class
        );
        return count != null && count > 0;
    }

    MarketDataLatestExchangeRate findLatestDailyExchangeRate(String currencyCode) {
        return jdbcTemplate.query(
            """
                SELECT base_date, deal_bas_rate
                FROM exchange_rates
                WHERE currency_code = ?
                ORDER BY base_date DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new MarketDataLatestExchangeRate(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("deal_bas_rate")),
            currencyCode
        ).stream().findFirst().orElse(null);
    }

    LocalDate findLatestDailyExchangeRateDate(String currencyCode) {
        return jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM exchange_rates
                WHERE currency_code = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            currencyCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    LocalDate findEarliestDailyExchangeRateDate(String currencyCode) {
        return jdbcTemplate.query(
            """
                SELECT MIN(base_date)
                FROM exchange_rates
                WHERE currency_code = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            currencyCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    NavigableMap<LocalDate, BigDecimal> findDailyExchangeRateMap(String currencyCode, LocalDate startDate) {
        NavigableMap<LocalDate, BigDecimal> rates = new TreeMap<>();
        jdbcTemplate.query(
            """
                SELECT base_date, deal_bas_rate
                FROM exchange_rates
                WHERE currency_code = ?
                  AND base_date >= ?
                ORDER BY base_date ASC
                """,
            (org.springframework.jdbc.core.RowCallbackHandler) rs -> rates.put(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("deal_bas_rate")),
            currencyCode,
            startDate
        );
        return rates;
    }

    List<LocalDate> findDailyUsdKrwDates(LocalDate startDate, LocalDate endDate) {
        return jdbcTemplate.query(
            """
                SELECT base_date
                FROM exchange_rates
                WHERE currency_code = ?
                  AND base_date BETWEEN ? AND ?
                """,
            (rs, rowNum) -> rs.getDate("base_date").toLocalDate(),
            "USD",
            startDate,
            endDate
        );
    }

    boolean hasMajorExchangeRateCoverageForDate(LocalDate baseDate, int expectedCount) {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(DISTINCT currency_code)
                FROM exchange_rates
                WHERE base_date = ?
                  AND (
                    currency_code = 'USD'
                    OR currency_code LIKE 'JPY%'
                    OR currency_code LIKE 'EUR%'
                    OR currency_code LIKE 'CNH%'
                    OR currency_code LIKE 'CNY%'
                    OR currency_code LIKE 'GBP%'
                    OR currency_code LIKE 'AUD%'
                    OR currency_code LIKE 'CAD%'
                    OR currency_code LIKE 'CHF%'
                    OR currency_code LIKE 'HKD%'
                    OR currency_code LIKE 'SGD%'
                  )
                """,
            Integer.class,
            baseDate
        );
        return count != null && count >= expectedCount;
    }
}
