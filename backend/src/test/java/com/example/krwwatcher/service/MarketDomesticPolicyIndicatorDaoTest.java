package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class MarketDomesticPolicyIndicatorDaoTest {

    private JdbcTemplate jdbcTemplate;
    private MarketDomesticPolicyIndicatorDao dao;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
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
        dao = new MarketDomesticPolicyIndicatorDao(jdbcTemplate);
    }

    @Test
    void upsertsDomesticPolicyIndicatorByCodeAndBaseDate() {
        LocalDate baseDate = LocalDate.of(2026, 6, 30);

        dao.upsertDomesticPolicyIndicator("M2", "M2 통화량", "통화 정책", baseDate, new BigDecimal("42000000.0000"), "KRW_100M", "ECOS:161Y005", Instant.parse("2026-07-01T00:00:00Z"));
        dao.upsertDomesticPolicyIndicator("M2", "M2 통화량", "통화 정책", baseDate, new BigDecimal("43000000.0000"), "KRW_100M", "ECOS:161Y005", Instant.parse("2026-07-02T00:00:00Z"));

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM domestic_policy_indicators", Integer.class);
        BigDecimal storedValue = jdbcTemplate.queryForObject("SELECT value FROM domestic_policy_indicators WHERE indicator_code = 'M2'", BigDecimal.class);

        assertThat(count).isEqualTo(1);
        assertThat(storedValue).isEqualByComparingTo("43000000.0000");
        assertThat(dao.findLatestDomesticPolicyDate("M2")).isEqualTo(baseDate);
        assertThat(dao.findEarliestDomesticPolicyDate("M2")).isEqualTo(baseDate);
    }

    @Test
    void evaluatesRecentFetchAndCoverage() {
        dao.upsertDomesticPolicyIndicator("FISCAL_BALANCE", "재정수지", "재정 정책", LocalDate.of(2026, 1, 31), new BigDecimal("-10.2500"), "KRW_TRILLION", "OPENFISCAL:BudgetBalance", Instant.parse("2026-08-29T00:00:00Z"));

        assertThat(dao.hasRecentDomesticPolicyFetch("FISCAL_BALANCE", Instant.parse("2026-08-28T00:00:00Z"))).isTrue();
        assertThat(dao.hasRecentDomesticPolicyFetch("FISCAL_BALANCE", Instant.parse("2026-08-30T00:00:00Z"))).isFalse();
        assertThat(dao.hasDomesticPolicyCoverage("FISCAL_BALANCE", LocalDate.of(2025, 12, 20))).isTrue();
        assertThat(dao.hasDomesticPolicyCoverage("FISCAL_BALANCE", LocalDate.of(2025, 12, 10))).isFalse();
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:market-domestic-policy-dao-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
