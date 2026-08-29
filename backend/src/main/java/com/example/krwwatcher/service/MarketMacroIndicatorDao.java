package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.Set;

import org.springframework.jdbc.core.JdbcTemplate;

// Handles macro market tables used by market data sync.
class MarketMacroIndicatorDao {

    private final JdbcTemplate jdbcTemplate;

    MarketMacroIndicatorDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    int upsertDollarIndex(LocalDate baseDate, String seriesId, BigDecimal value, String source, Instant fetchedAt) {
        return jdbcTemplate.update("""
                INSERT INTO dollar_indexes (base_date, series_id, value, source, fetched_at)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    value = VALUES(value),
                    source = VALUES(source),
                    fetched_at = VALUES(fetched_at)
                """,
            baseDate,
            seriesId,
            value,
            source,
            fetchedAt
        );
    }

    LocalDate findLatestDollarIndexDate(String seriesId) {
        return jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM dollar_indexes
                WHERE series_id = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            seriesId
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    int upsertInterestRate(LocalDate baseDate, String countryCode, String rateType, BigDecimal value, String source, Instant fetchedAt) {
        return jdbcTemplate.update("""
                INSERT INTO interest_rates (base_date, country_code, rate_type, rate_value, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    rate_value = VALUES(rate_value),
                    source = VALUES(source),
                    fetched_at = VALUES(fetched_at)
                """,
            baseDate,
            countryCode,
            rateType,
            value,
            source,
            fetchedAt
        );
    }

    LocalDate findLatestInterestRateDate(String countryCode, String rateType) {
        return jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM interest_rates
                WHERE country_code = ?
                  AND rate_type = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            countryCode,
            rateType
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    LocalDate findEarliestInterestRateDate(String countryCode, String rateType) {
        return jdbcTemplate.query(
            """
                SELECT MIN(base_date)
                FROM interest_rates
                WHERE country_code = ?
                  AND rate_type = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            countryCode,
            rateType
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    boolean hasRecentInterestRateFetch(String countryCode, String rateType, Instant threshold) {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM interest_rates
                WHERE country_code = ?
                  AND rate_type = ?
                  AND fetched_at >= ?
                """,
            Integer.class,
            countryCode,
            rateType,
            threshold
        );
        return count != null && count > 0;
    }

    boolean hasInterestRateCoverage(String countryCode, String rateType, LocalDate targetStartDate) {
        LocalDate earliestDate = findEarliestInterestRateDate(countryCode, rateType);
        return earliestDate != null && !earliestDate.isAfter(targetStartDate.plusDays(45));
    }

    int upsertForeignReserve(LocalDate baseDate, BigDecimal amountUsdMillion, String source, Instant fetchedAt) {
        return jdbcTemplate.update("""
                INSERT INTO foreign_reserves (base_date, amount_usd_million, source, fetched_at)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    amount_usd_million = VALUES(amount_usd_million),
                    source = VALUES(source),
                    fetched_at = VALUES(fetched_at)
            """,
            baseDate,
            amountUsdMillion,
            source,
            fetchedAt
        );
    }

    boolean hasRecentTableFetch(String tableName, Instant threshold) {
        if (!Set.of("effective_exchange_rates", "foreign_reserves").contains(tableName)) {
            throw new IllegalArgumentException("Unsupported freshness table: " + tableName);
        }

        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM " + tableName + " WHERE fetched_at >= ?",
            Integer.class,
            threshold
        );
        return count != null && count > 0;
    }
}
