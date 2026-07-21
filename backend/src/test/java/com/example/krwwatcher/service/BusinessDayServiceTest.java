package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Set;
import java.util.UUID;

import javax.sql.DataSource;

import com.example.krwwatcher.external.KasiSpecialDayClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;

class BusinessDayServiceTest {

    private JdbcTemplate jdbcTemplate;
    private KasiSpecialDayClient kasiSpecialDayClient;
    private BusinessDayService businessDayService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
        createCalendarTables();
        kasiSpecialDayClient = org.mockito.Mockito.mock(KasiSpecialDayClient.class);
        businessDayService = new BusinessDayService(kasiSpecialDayClient, jdbcTemplate);
    }

    @Test
    void cachedHolidayRemainsHolidayWhenKasiFails() {
        LocalDate holiday = LocalDate.of(2026, 8, 17);
        insertCachedHoliday(holiday);
        when(kasiSpecialDayClient.isConfigured()).thenReturn(true);
        when(kasiSpecialDayClient.fetchKoreanPublicHolidays(any(YearMonth.class)))
            .thenThrow(new IllegalStateException("KASI unavailable"));

        BusinessDayService.KoreanBusinessDayStatus status = businessDayService.koreanBusinessDayStatus(holiday);

        assertThat(status).isEqualTo(BusinessDayService.KoreanBusinessDayStatus.NON_BUSINESS_DAY);
        assertThat(businessDayService.isKoreanBusinessDay(holiday)).isFalse();
        verify(kasiSpecialDayClient, never()).fetchKoreanPublicHolidays(any(YearMonth.class));
    }

    @Test
    void dailyBackfillSkipsWhenHolidayCalendarIsUncertainAfterKasiFailure() {
        createExchangeRateTables();
        LocalDate missingWeekday = latestMissingWeekdayInBackfillWindow();
        insertIntradayClose(missingWeekday);
        when(kasiSpecialDayClient.isConfigured()).thenReturn(true);
        when(kasiSpecialDayClient.fetchKoreanPublicHolidays(any(YearMonth.class)))
            .thenThrow(new IllegalStateException("KASI unavailable"));
        MarketDataSyncService syncService = new MarketDataSyncService(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            businessDayService,
            jdbcTemplate
        );

        Integer rows = ReflectionTestUtils.invokeMethod(syncService, "backfillMissingWeekdaysFromIntraday");

        assertThat(rows).isZero();
        Integer dailyRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM exchange_rates", Integer.class);
        assertThat(dailyRows).isZero();
        String calendarStatus = jdbcTemplate.queryForObject(
            "SELECT status FROM korean_holiday_calendar_syncs WHERE calendar_year = ?",
            String.class,
            missingWeekday.getYear()
        );
        assertThat(calendarStatus).isEqualTo("FAILED");
    }

    @Test
    void cachedSuccessfulCalendarCanClassifyNonHolidayWithoutCallingKasi() {
        LocalDate businessDay = LocalDate.of(2026, 7, 21);
        insertSuccessfulCalendarStatus(businessDay.getYear());
        when(kasiSpecialDayClient.isConfigured()).thenReturn(true);

        BusinessDayService.KoreanBusinessDayStatus status = businessDayService.koreanBusinessDayStatus(businessDay);

        assertThat(status).isEqualTo(BusinessDayService.KoreanBusinessDayStatus.BUSINESS_DAY);
        verify(kasiSpecialDayClient, never()).fetchKoreanPublicHolidays(any(YearMonth.class));
    }

    private LocalDate latestMissingWeekdayInBackfillWindow() {
        LocalDate endDate = LocalDate.now().minusDays(1);
        LocalDate startDate = LocalDate.now().minusDays(14);
        for (LocalDate date = endDate; !date.isBefore(startDate); date = date.minusDays(1)) {
            if (date.getDayOfWeek().getValue() <= 5) {
                return date;
            }
        }
        throw new IllegalStateException("No weekday in backfill window");
    }

    private void insertCachedHoliday(LocalDate holiday) {
        jdbcTemplate.update(
            """
                INSERT INTO korean_public_holidays (calendar_year, holiday_date, source, synced_at)
                VALUES (?, ?, ?, ?)
                """,
            holiday.getYear(),
            holiday,
            "KASI",
            Instant.now()
        );
    }

    private void insertSuccessfulCalendarStatus(int year) {
        jdbcTemplate.update(
            """
                INSERT INTO korean_holiday_calendar_syncs (calendar_year, status, last_synced_at, message)
                VALUES (?, ?, ?, ?)
                """,
            year,
            "SUCCESS",
            Instant.now(),
            "test"
        );
    }

    private void insertIntradayClose(LocalDate baseDate) {
        jdbcTemplate.update(
            """
                INSERT INTO intraday_exchange_rates (observed_at, currency_pair, close_rate, source, fetched_at)
                VALUES (?, ?, ?, ?, ?)
                """,
            baseDate.atTime(23, 59),
            "USD/KRW",
            new BigDecimal("1380.1200"),
            "TWELVE_DATA",
            Instant.now()
        );
    }

    private void createCalendarTables() {
        jdbcTemplate.execute("""
            CREATE TABLE korean_public_holidays (
                id BIGINT NOT NULL AUTO_INCREMENT,
                calendar_year INT NOT NULL,
                holiday_date DATE NOT NULL,
                source VARCHAR(50) NOT NULL,
                synced_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uk_korean_public_holidays_date (holiday_date)
            )
            """);
        jdbcTemplate.execute("""
            CREATE TABLE korean_holiday_calendar_syncs (
                calendar_year INT NOT NULL,
                status VARCHAR(30) NOT NULL,
                last_synced_at TIMESTAMP NULL,
                message VARCHAR(1000) NULL,
                PRIMARY KEY (calendar_year)
            )
            """);
    }

    private void createExchangeRateTables() {
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
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:business-day-service-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
