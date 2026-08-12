package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import javax.sql.DataSource;

import com.example.krwwatcher.external.KoreaeximExchangeClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

class ExchangeRateSeparationTest {

    private JdbcTemplate jdbcTemplate;
    private DashboardService dashboardService;
    private MarketDataSyncService marketDataSyncService;

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
                source VARCHAR(50) NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_exchange_rates_currency_date (currency_code, base_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE current_exchange_rates (
                id BIGINT NOT NULL AUTO_INCREMENT,
                base_date DATE NOT NULL,
                currency_code VARCHAR(10) NOT NULL,
                currency_name VARCHAR(100) NOT NULL,
                deal_bas_rate DECIMAL(19, 4) NOT NULL,
                source VARCHAR(50) NOT NULL,
                observed_at TIMESTAMP NOT NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_current_exchange_rates_currency (currency_code)
            )
            """);
        dashboardService = new DashboardService(null, null, null, null, null, jdbcTemplate);
        marketDataSyncService = new MarketDataSyncService(null, null, null, null, null, null, null, null, null, jdbcTemplate);
    }

    @Test
    void keepsCurrentExchangeRateWhenFredDailyUpsertsSameDate() {
        LocalDate baseDate = LocalDate.of(2026, 7, 20);
        Instant currentFetchedAt = Instant.parse("2026-07-20T01:00:00Z");

        ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "upsertCurrentExchangeRate",
            baseDate,
            "USD",
            "US Dollar",
            new BigDecimal("1399.1200"),
            "TWELVE_DATA:exchange_rate:USD/KRW",
            currentFetchedAt
        );
        ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "upsertExchangeRate",
            baseDate,
            "USD",
            "US Dollar",
            new BigDecimal("1388.3400"),
            "FRED:DEXKOUS",
            Instant.parse("2026-07-20T02:00:00Z")
        );

        DashboardService.ExchangeRateSnapshotResponse snapshot = dashboardService.exchangeRateSnapshot("USD", baseDate);

        assertThat(snapshot.currentRate().dealBasRate()).isEqualByComparingTo("1399.1200");
        assertThat(snapshot.currentRate().fetchedAt()).isEqualTo(currentFetchedAt);
        assertThat(snapshot.historicalRate().dealBasRate()).isEqualByComparingTo("1388.3400");
        assertThat(snapshot.historicalRate().source()).isEqualTo("FRED:DEXKOUS");

        @SuppressWarnings("unchecked")
        List<DashboardService.ForeignExchangeRate> cardRates = ReflectionTestUtils.invokeMethod(dashboardService, "findForeignExchangeRates");
        DashboardService.ForeignExchangeRate usdCardRate = cardRates.stream()
            .filter(rate -> "USD".equals(rate.currencyCode()))
            .findFirst()
            .orElseThrow();
        assertThat(usdCardRate.dealBasRate()).isEqualByComparingTo("1399.1200");
        assertThat(usdCardRate.fetchedAt()).isEqualTo(currentFetchedAt);
    }

    @Test
    void historicalCalculatorLookupDoesNotUseCurrentExchangeRate() {
        LocalDate baseDate = LocalDate.of(2026, 7, 20);
        ReflectionTestUtils.invokeMethod(
            marketDataSyncService,
            "upsertCurrentExchangeRate",
            baseDate,
            "USD",
            "US Dollar",
            new BigDecimal("1399.1200"),
            "TWELVE_DATA:exchange_rate:USD/KRW",
            Instant.parse("2026-07-20T01:00:00Z")
        );

        DashboardService.ExchangeRateSnapshotResponse snapshot = dashboardService.exchangeRateSnapshot("USD", baseDate);

        assertThat(snapshot.currentRate()).isNotNull();
        assertThat(snapshot.historicalRate()).isNull();
    }

    @Test
    void dailyBackfillStoresMissingNonUsdExchangeRatesFromKoreaexim() {
        LocalDate missingDate = latestWeekdayInBackfillWindow();
        BusinessDayService businessDayService = org.mockito.Mockito.mock(BusinessDayService.class);
        KoreaeximExchangeClient koreaeximExchangeClient = org.mockito.Mockito.mock(KoreaeximExchangeClient.class);
        when(businessDayService.koreanBusinessDayStatus(any(LocalDate.class)))
            .thenReturn(BusinessDayService.KoreanBusinessDayStatus.NON_BUSINESS_DAY);
        when(businessDayService.koreanBusinessDayStatus(eq(missingDate)))
            .thenReturn(BusinessDayService.KoreanBusinessDayStatus.BUSINESS_DAY);
        when(koreaeximExchangeClient.fetchExchangeRates(eq(missingDate), any(Set.class)))
            .thenReturn(List.of(
                new KoreaeximExchangeClient.ExchangeRatePayload(missingDate, "USD", "US Dollar", new BigDecimal("1390.0000")),
                new KoreaeximExchangeClient.ExchangeRatePayload(missingDate, "EUR", "Euro", new BigDecimal("1620.1200")),
                new KoreaeximExchangeClient.ExchangeRatePayload(missingDate, "JPY(100)", "Japanese Yen", new BigDecimal("945.3400"))
            ));
        MarketDataSyncService syncService = new MarketDataSyncService(
            null,
            null,
            koreaeximExchangeClient,
            null,
            null,
            null,
            null,
            null,
            businessDayService,
            jdbcTemplate
        );

        Integer rows = ReflectionTestUtils.invokeMethod(syncService, "backfillMissingMajorExchangeRateWeekdaysFromKoreaexim");

        assertThat(rows).isEqualTo(2);
        Integer usdRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM exchange_rates WHERE currency_code = 'USD'", Integer.class);
        assertThat(usdRows).isZero();
        BigDecimal eurRate = jdbcTemplate.queryForObject("SELECT deal_bas_rate FROM exchange_rates WHERE currency_code = 'EUR' AND base_date = ?", BigDecimal.class, missingDate);
        assertThat(eurRate).isEqualByComparingTo("1620.1200");
        BigDecimal jpyRate = jdbcTemplate.queryForObject("SELECT deal_bas_rate FROM exchange_rates WHERE currency_code = 'JPY(100)' AND base_date = ?", BigDecimal.class, missingDate);
        assertThat(jpyRate).isEqualByComparingTo("945.3400");
    }

    private LocalDate latestWeekdayInBackfillWindow() {
        LocalDate endDate = LocalDate.now().minusDays(1);
        LocalDate startDate = LocalDate.now().minusDays(14);
        for (LocalDate date = endDate; !date.isBefore(startDate); date = date.minusDays(1)) {
            if (date.getDayOfWeek().getValue() <= 5) {
                return date;
            }
        }
        throw new IllegalStateException("No weekday in backfill window");
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:exchange-rate-separation-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
