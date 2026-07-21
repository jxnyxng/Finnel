package com.example.krwwatcher.service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import com.example.krwwatcher.external.KasiSpecialDayClient;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class BusinessDayService {

    private static final String CALENDAR_STATUS_SUCCESS = "SUCCESS";
    private static final String CALENDAR_STATUS_FAILED = "FAILED";
    private static final String CALENDAR_STATUS_UNCONFIGURED = "UNCONFIGURED";

    private final KasiSpecialDayClient kasiSpecialDayClient;
    private final JdbcTemplate jdbcTemplate;

    public BusinessDayService(KasiSpecialDayClient kasiSpecialDayClient, JdbcTemplate jdbcTemplate) {
        this.kasiSpecialDayClient = kasiSpecialDayClient;
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean isKoreanBusinessDay(LocalDate date) {
        return koreanBusinessDayStatus(date) == KoreanBusinessDayStatus.BUSINESS_DAY;
    }

    public KoreanBusinessDayStatus koreanBusinessDayStatus(LocalDate date) {
        if (!isWeekday(date)) {
            return KoreanBusinessDayStatus.NON_BUSINESS_DAY;
        }

        int year = date.getYear();
        if (hasCachedHoliday(date)) {
            return KoreanBusinessDayStatus.NON_BUSINESS_DAY;
        }

        if (hasSuccessfulCalendar(year)) {
            return KoreanBusinessDayStatus.BUSINESS_DAY;
        }

        if (!kasiSpecialDayClient.isConfigured()) {
            recordCalendarStatus(year, CALENDAR_STATUS_UNCONFIGURED, null, "KASI holiday API is not configured");
            return KoreanBusinessDayStatus.UNKNOWN;
        }

        try {
            syncYear(year);
        } catch (RuntimeException exception) {
            recordCalendarStatus(year, CALENDAR_STATUS_FAILED, null, exception.getMessage());
        }

        if (hasCachedHoliday(date)) {
            return KoreanBusinessDayStatus.NON_BUSINESS_DAY;
        }

        return hasSuccessfulCalendar(year)
            ? KoreanBusinessDayStatus.BUSINESS_DAY
            : KoreanBusinessDayStatus.UNKNOWN;
    }

    public LocalDate previousKoreanBusinessDay(LocalDate date) {
        LocalDate candidate = date.minusDays(1);
        int guard = 0;
        while (!isKoreanBusinessDay(candidate)) {
            candidate = candidate.minusDays(1);
            guard++;
            if (guard > 370) {
                throw new IllegalStateException("Korean holiday calendar is uncertain for more than one year");
            }
        }
        return candidate;
    }

    public List<HolidayCalendarStatus> holidayCalendarStatuses(int fromYear, int toYear) {
        List<HolidayCalendarStatus> rows = jdbcTemplate.query(
            """
                SELECT calendar_year, status, last_synced_at, message
                FROM korean_holiday_calendar_syncs
                WHERE calendar_year BETWEEN ? AND ?
                ORDER BY calendar_year ASC
                """,
            (rs, rowNum) -> new HolidayCalendarStatus(
                rs.getInt("calendar_year"),
                rs.getString("status"),
                rs.getTimestamp("last_synced_at") == null ? null : rs.getTimestamp("last_synced_at").toInstant(),
                rs.getString("message")
            ),
            fromYear,
            toYear
        );
        Map<Integer, HolidayCalendarStatus> byYear = new HashMap<>();
        for (HolidayCalendarStatus row : rows) {
            byYear.put(row.year(), row);
        }

        return java.util.stream.IntStream.rangeClosed(fromYear, toYear)
            .mapToObj(year -> byYear.getOrDefault(year, new HolidayCalendarStatus(year, "UNKNOWN", null, "holiday calendar has not been synced")))
            .toList();
    }

    private void syncYear(int year) {
        Set<LocalDate> holidays = new TreeSet<>();
        for (int month = 1; month <= 12; month++) {
            holidays.addAll(kasiSpecialDayClient.fetchKoreanPublicHolidays(YearMonth.of(year, month)));
        }

        Instant syncedAt = Instant.now();
        jdbcTemplate.update("DELETE FROM korean_public_holidays WHERE calendar_year = ?", year);
        List<LocalDate> sortedHolidays = holidays.stream()
            .filter(date -> date.getYear() == year)
            .sorted(Comparator.naturalOrder())
            .toList();
        for (LocalDate holiday : sortedHolidays) {
            jdbcTemplate.update(
                """
                    INSERT INTO korean_public_holidays (calendar_year, holiday_date, source, synced_at)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        calendar_year = VALUES(calendar_year),
                        source = VALUES(source),
                        synced_at = VALUES(synced_at)
                    """,
                year,
                holiday,
                "KASI",
                syncedAt
            );
        }
        recordCalendarStatus(year, CALENDAR_STATUS_SUCCESS, syncedAt, "holidays=" + sortedHolidays.size());
    }

    private boolean hasCachedHoliday(LocalDate date) {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM korean_public_holidays
                WHERE holiday_date = ?
                """,
            Integer.class,
            date
        );
        return count != null && count > 0;
    }

    private boolean hasSuccessfulCalendar(int year) {
        return jdbcTemplate.query(
            """
                SELECT status
                FROM korean_holiday_calendar_syncs
                WHERE calendar_year = ?
                """,
            (rs, rowNum) -> rs.getString("status"),
            year
        ).stream().findFirst().filter(CALENDAR_STATUS_SUCCESS::equals).isPresent();
    }

    private void recordCalendarStatus(int year, String status, Instant syncedAt, String message) {
        jdbcTemplate.update(
            """
                INSERT INTO korean_holiday_calendar_syncs (calendar_year, status, last_synced_at, message)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    status = VALUES(status),
                    last_synced_at = COALESCE(VALUES(last_synced_at), last_synced_at),
                    message = VALUES(message)
                """,
            year,
            status,
            syncedAt,
            truncate(message)
        );
    }

    private boolean isWeekday(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        return dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY;
    }

    private String truncate(String message) {
        if (message == null || message.length() <= 1000) {
            return message;
        }

        return message.substring(0, 1000);
    }

    public enum KoreanBusinessDayStatus {
        BUSINESS_DAY,
        NON_BUSINESS_DAY,
        UNKNOWN
    }

    public record HolidayCalendarStatus(
        int year,
        String status,
        Instant lastSyncedAt,
        String message
    ) {
    }
}
