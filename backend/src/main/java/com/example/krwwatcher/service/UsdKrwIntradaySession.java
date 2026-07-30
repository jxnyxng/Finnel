package com.example.krwwatcher.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public final class UsdKrwIntradaySession {

    private static final LocalTime DAYLIGHT_SAVING_SESSION_START = LocalTime.of(6, 0);
    private static final LocalTime STANDARD_SESSION_START = LocalTime.of(7, 0);

    private UsdKrwIntradaySession() {
    }

    public static LocalDateTime startDateTime(LocalDate sessionStartDate) {
        return LocalDateTime.of(sessionStartDate, startTime(sessionStartDate));
    }

    public static LocalDateTime endDateTime(LocalDate sessionStartDate) {
        return startDateTime(sessionStartDate).plusDays(1);
    }

    public static LocalDate sessionStartDate(LocalDateTime observedAt) {
        LocalDate observedDate = observedAt.toLocalDate();
        LocalDate candidate = !observedAt.toLocalTime().isBefore(startTime(observedDate))
            ? observedDate
            : previousSessionStartDate(observedDate);
        return canStartSession(candidate) ? candidate : previousSessionStartDate(candidate);
    }

    public static LocalDate activeSessionStartDate(LocalDateTime now) {
        LocalDate candidate = sessionStartDate(now);
        return canStartSession(candidate) && now.isBefore(endDateTime(candidate)) ? candidate : null;
    }

    public static LocalDate previousSessionStartDate(LocalDate date) {
        LocalDate candidate = date.minusDays(1);
        while (!canStartSession(candidate)) {
            candidate = candidate.minusDays(1);
        }
        return candidate;
    }

    public static boolean canStartSession(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        return dayOfWeek != DayOfWeek.SATURDAY
            && dayOfWeek != DayOfWeek.SUNDAY
            && !(date.getMonthValue() == 1 && date.getDayOfMonth() == 1);
    }

    public static LocalTime startTime(LocalDate sessionStartDate) {
        return isNewYorkDaylightSavingDate(sessionStartDate)
            ? DAYLIGHT_SAVING_SESSION_START
            : STANDARD_SESSION_START;
    }

    private static boolean isNewYorkDaylightSavingDate(LocalDate date) {
        LocalDate starts = nthSunday(date.getYear(), 3, 2);
        LocalDate ends = nthSunday(date.getYear(), 11, 1);
        return !date.isBefore(starts) && !date.isAfter(ends);
    }

    private static LocalDate nthSunday(int year, int month, int nth) {
        LocalDate date = LocalDate.of(year, month, 1);
        int daysUntilSunday = Math.floorMod(DayOfWeek.SUNDAY.getValue() - date.getDayOfWeek().getValue(), 7);
        return date.plusDays(daysUntilSunday + 7L * (nth - 1));
    }
}
