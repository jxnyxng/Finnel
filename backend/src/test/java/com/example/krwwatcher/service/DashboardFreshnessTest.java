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
import org.springframework.test.util.ReflectionTestUtils;

class DashboardFreshnessTest {

    private JdbcTemplate jdbcTemplate;
    private DashboardService dashboardService;

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
        dashboardService = new DashboardService(null, null, null, null, null, jdbcTemplate);
    }

    @Test
    void staleFetchedAtFixtureMarksDomesticIndicatorAsDelayed() {
        jdbcTemplate.update(
            """
                INSERT INTO domestic_policy_indicators (indicator_code, title, category, base_date, value, unit, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
            "FISCAL_BALANCE",
            "재정수지",
            "재정 정책",
            LocalDate.of(2020, 1, 31),
            new BigDecimal("-10.2500"),
            "KRW_TRILLION",
            "OPENFISCAL:BudgetBalance",
            Instant.parse("2020-02-01T00:00:00Z")
        );

        DashboardService.DomesticIndicator indicator = ReflectionTestUtils.invokeMethod(
            dashboardService,
            "domesticPolicyIndicator",
            "FISCAL_BALANCE"
        );

        assertThat(indicator).isNotNull();
        assertThat(indicator.freshnessStatus()).isEqualTo("STALE");
        assertThat(indicator.status()).isEqualTo("업데이트 지연");
        assertThat(indicator.staleReason()).contains("허용 지연");
        assertThat(indicator.lastSuccessfulFetchedAt()).isEqualTo(Instant.parse("2020-02-01T00:00:00Z"));
    }

    @Test
    void recentlyFetchedOldPublishedValueIsStillCollectedNormally() {
        Instant fetchedAt = Instant.now();
        jdbcTemplate.update(
            """
                INSERT INTO domestic_policy_indicators (indicator_code, title, category, base_date, value, unit, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
            "FISCAL_BALANCE",
            "재정수지",
            "재정 정책",
            LocalDate.now().minusMonths(3),
            new BigDecimal("-10.2500"),
            "KRW_TRILLION",
            "OPENFISCAL:BudgetBalance",
            fetchedAt
        );

        DashboardService.DomesticIndicator indicator = ReflectionTestUtils.invokeMethod(
            dashboardService,
            "domesticPolicyIndicator",
            "FISCAL_BALANCE"
        );

        assertThat(indicator).isNotNull();
        assertThat(indicator.freshnessStatus()).isEqualTo("FRESH");
        assertThat(indicator.status()).isEqualTo("정상 수집");
        assertThat(indicator.lastSuccessfulFetchedAt()).isEqualTo(fetchedAt);
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:dashboard-freshness-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
