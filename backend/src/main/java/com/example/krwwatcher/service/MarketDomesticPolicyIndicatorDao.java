package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

import org.springframework.jdbc.core.JdbcTemplate;

// Handles domestic_policy_indicators persistence and freshness coverage queries.
class MarketDomesticPolicyIndicatorDao {

    private final JdbcTemplate jdbcTemplate;

    MarketDomesticPolicyIndicatorDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    int upsertDomesticPolicyIndicator(String code, String title, String category, LocalDate baseDate, BigDecimal value, String unit, String source, Instant fetchedAt) {
        return jdbcTemplate.update("""
                INSERT INTO domestic_policy_indicators (indicator_code, title, category, base_date, value, unit, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    title = VALUES(title),
                    category = VALUES(category),
                    value = VALUES(value),
                    unit = VALUES(unit),
                    source = VALUES(source),
                    fetched_at = VALUES(fetched_at)
                """,
            code,
            title,
            category,
            baseDate,
            value,
            unit,
            source,
            fetchedAt
        );
    }

    LocalDate findLatestDomesticPolicyDate(String indicatorCode) {
        return jdbcTemplate.query(
            """
                SELECT MAX(base_date)
                FROM domestic_policy_indicators
                WHERE indicator_code = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            indicatorCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    LocalDate findEarliestDomesticPolicyDate(String indicatorCode) {
        return jdbcTemplate.query(
            """
                SELECT MIN(base_date)
                FROM domestic_policy_indicators
                WHERE indicator_code = ?
                """,
            (rs, rowNum) -> rs.getDate(1) == null ? null : rs.getDate(1).toLocalDate(),
            indicatorCode
        ).stream().filter(Objects::nonNull).findFirst().orElse(null);
    }

    boolean hasRecentDomesticPolicyFetch(String indicatorCode, Instant threshold) {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM domestic_policy_indicators
                WHERE indicator_code = ?
                  AND fetched_at >= ?
                """,
            Integer.class,
            indicatorCode,
            threshold
        );
        return count != null && count > 0;
    }

    boolean hasDomesticPolicyCoverage(String indicatorCode, LocalDate targetStartDate) {
        LocalDate earliestDate = findEarliestDomesticPolicyDate(indicatorCode);
        return earliestDate != null && !earliestDate.isAfter(targetStartDate.plusDays(45));
    }
}
