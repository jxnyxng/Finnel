package com.example.krwwatcher.health;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

import javax.sql.DataSource;

import com.example.krwwatcher.config.ExternalApiProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class OperationalHealthIndicatorTest {

    private JdbcTemplate jdbcTemplate;
    private OperationalHealthIndicator healthIndicator;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
        createTables();
        healthIndicator = new OperationalHealthIndicator(jdbcTemplate, configuredProperties());
    }

    @Test
    void healthyWhenCoreSyncContentAndApiConfigurationAreCurrent() {
        Instant now = Instant.now();
        insertJob("MARKET_DATA_SYNC", "SUCCESS", now.minus(Duration.ofMinutes(5)), now.minus(Duration.ofMinutes(4)));
        insertJob("INTRADAY_EXCHANGE_SYNC", "SUCCESS", now.minus(Duration.ofMinutes(4)), now.minus(Duration.ofMinutes(3)));
        insertNews(now.minus(Duration.ofMinutes(10)));
        insertBriefing(now.minus(Duration.ofMinutes(10)));

        Health health = healthIndicator.health();

        assertThat(health.getStatus().getCode()).isEqualTo("UP");
    }

    @Test
    void downAfterTwoConsecutiveFullCollectionFailures() {
        Instant now = Instant.now();
        insertJob("MARKET_DATA_SYNC", "FAILED_CORE_SOURCE", now.minus(Duration.ofMinutes(10)), now.minus(Duration.ofMinutes(9)));
        insertJob("MARKET_DATA_SYNC", "FAILED_CORE_SOURCE", now.minus(Duration.ofMinutes(5)), now.minus(Duration.ofMinutes(4)));
        insertNews(now.minus(Duration.ofMinutes(10)));
        insertBriefing(now.minus(Duration.ofMinutes(10)));

        Health health = healthIndicator.health();

        assertThat(health.getStatus().getCode()).isEqualTo("DOWN");
        assertThat(health.getDetails()).containsKey("coreSync");
    }

    @Test
    void degradedWhenExternalApiConfigurationIsMissing() {
        Instant now = Instant.now();
        insertJob("MARKET_DATA_SYNC", "SUCCESS", now.minus(Duration.ofMinutes(5)), now.minus(Duration.ofMinutes(4)));
        insertNews(now.minus(Duration.ofMinutes(10)));
        insertBriefing(now.minus(Duration.ofMinutes(10)));
        healthIndicator = new OperationalHealthIndicator(jdbcTemplate, missingProperties());

        Health health = healthIndicator.health();

        assertThat(health.getStatus().getCode()).isEqualTo("DEGRADED");
    }

    @Test
    void degradedWhenNewsOrBriefingFetchIsOlderThanOneHour() {
        Instant now = Instant.now();
        insertJob("MARKET_DATA_SYNC", "SUCCESS", now.minus(Duration.ofMinutes(5)), now.minus(Duration.ofMinutes(4)));
        insertNews(now.minus(Duration.ofHours(2)));
        insertBriefing(now.minus(Duration.ofMinutes(10)));

        Health health = healthIndicator.health();

        assertThat(health.getStatus().getCode()).isEqualTo("DEGRADED");
    }

    private void createTables() {
        jdbcTemplate.execute("""
            CREATE TABLE batch_job_runs (
                id BIGINT NOT NULL AUTO_INCREMENT,
                job_name VARCHAR(100) NOT NULL,
                status VARCHAR(30) NOT NULL,
                started_at TIMESTAMP NOT NULL,
                ended_at TIMESTAMP NULL,
                message VARCHAR(1000) NULL,
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE intraday_exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                observed_at TIMESTAMP NOT NULL,
                currency_pair VARCHAR(20) NOT NULL,
                close_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE news_articles (
                id BIGINT NOT NULL AUTO_INCREMENT,
                category_code VARCHAR(30) NOT NULL,
                category_name VARCHAR(50) NOT NULL,
                query_text VARCHAR(100) NOT NULL,
                article_key VARCHAR(500) NOT NULL,
                title VARCHAR(500) NOT NULL,
                description VARCHAR(1000) NULL,
                origin_link VARCHAR(1000) NULL,
                link VARCHAR(1000) NOT NULL,
                publisher VARCHAR(100) NULL,
                published_at TIMESTAMP NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE government_briefings (
                id BIGINT NOT NULL AUTO_INCREMENT,
                title VARCHAR(500) NOT NULL,
                body CLOB NULL,
                ministry VARCHAR(100) NULL,
                category VARCHAR(50) NOT NULL,
                published_at TIMESTAMP NULL,
                original_url VARCHAR(1000) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id)
            )
            """);
        insertIntraday(LocalDateTime.now().minusMinutes(1), Instant.now());
    }

    private void insertJob(String jobName, String status, Instant startedAt, Instant endedAt) {
        jdbcTemplate.update(
            "INSERT INTO batch_job_runs (job_name, status, started_at, ended_at, message) VALUES (?, ?, ?, ?, ?)",
            jobName,
            status,
            startedAt,
            endedAt,
            status
        );
    }

    private void insertIntraday(LocalDateTime observedAt, Instant fetchedAt) {
        jdbcTemplate.update(
            "INSERT INTO intraday_exchange_rates (observed_at, currency_pair, close_rate, source, fetched_at) VALUES (?, ?, ?, ?, ?)",
            observedAt,
            "USD/KRW",
            new BigDecimal("1380.0000"),
            "TWELVE_DATA",
            fetchedAt
        );
    }

    private void insertNews(Instant fetchedAt) {
        jdbcTemplate.update(
            """
                INSERT INTO news_articles (category_code, category_name, query_text, article_key, title, link, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
            "fx",
            "환율",
            "원달러 환율",
            UUID.randomUUID().toString(),
            "title",
            "https://example.com/news",
            fetchedAt
        );
    }

    private void insertBriefing(Instant fetchedAt) {
        jdbcTemplate.update(
            """
                INSERT INTO government_briefings (title, body, category, original_url, fetched_at)
                VALUES (?, ?, ?, ?, ?)
                """,
            "title",
            "body",
            "fx",
            "https://example.com/briefing",
            fetchedAt
        );
    }

    private ExternalApiProperties configuredProperties() {
        return new ExternalApiProperties(
            new ExternalApiProperties.Koreaexim("https://example.com", "key"),
            new ExternalApiProperties.Ecos("https://example.com", "key", "a", "b", "c", "d"),
            new ExternalApiProperties.Fred("https://example.com", "key", "a", "b", "c", "d", "e", "f", "g", "h"),
            new ExternalApiProperties.TwelveData("https://example.com", "key", "USD/KRW", "1min", 5000),
            new ExternalApiProperties.Bis("https://example.com/bis.zip"),
            new ExternalApiProperties.Naver("https://example.com", "id", "secret"),
            new ExternalApiProperties.OpenFiscal("https://example.com", "key"),
            new ExternalApiProperties.PolicyBriefing("https://example.com", "key"),
            new ExternalApiProperties.Kasi("https://example.com", "key")
        );
    }

    private ExternalApiProperties missingProperties() {
        return new ExternalApiProperties(
            new ExternalApiProperties.Koreaexim("https://example.com", ""),
            new ExternalApiProperties.Ecos("https://example.com", "", "a", "b", "c", "d"),
            new ExternalApiProperties.Fred("https://example.com", "", "a", "b", "c", "d", "e", "f", "g", "h"),
            new ExternalApiProperties.TwelveData("https://example.com", "", "USD/KRW", "1min", 5000),
            new ExternalApiProperties.Bis("https://example.com/bis.zip"),
            new ExternalApiProperties.Naver("https://example.com", "", ""),
            new ExternalApiProperties.OpenFiscal("https://example.com", ""),
            new ExternalApiProperties.PolicyBriefing("https://example.com", ""),
            new ExternalApiProperties.Kasi("https://example.com", "")
        );
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:operational-health-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
