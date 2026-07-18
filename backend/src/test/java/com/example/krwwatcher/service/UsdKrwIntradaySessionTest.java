package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.junit.jupiter.api.Test;

class UsdKrwIntradaySessionTest {

    @Test
    void usesDaylightSavingSessionFromSixToNextSix() {
        LocalDate sessionStartDate = LocalDate.of(2026, 7, 17);

        assertThat(UsdKrwIntradaySession.startTime(sessionStartDate)).isEqualTo(LocalTime.of(6, 0));
        assertThat(UsdKrwIntradaySession.startDateTime(sessionStartDate)).isEqualTo(LocalDateTime.of(2026, 7, 17, 6, 0));
        assertThat(UsdKrwIntradaySession.endDateTime(sessionStartDate)).isEqualTo(LocalDateTime.of(2026, 7, 18, 6, 0));
    }

    @Test
    void mapsEarlyMorningObservationToPreviousSession() {
        assertThat(UsdKrwIntradaySession.sessionStartDate(LocalDateTime.of(2026, 7, 18, 2, 0)))
            .isEqualTo(LocalDate.of(2026, 7, 17));
        assertThat(UsdKrwIntradaySession.sessionStartDate(LocalDateTime.of(2026, 7, 18, 5, 59)))
            .isEqualTo(LocalDate.of(2026, 7, 17));
        assertThat(UsdKrwIntradaySession.sessionStartDate(LocalDateTime.of(2026, 7, 18, 6, 0)))
            .isEqualTo(LocalDate.of(2026, 7, 17));
    }

    @Test
    void keepsFridaySessionOpenUntilSaturdaySixInSummerTime() {
        assertThat(UsdKrwIntradaySession.activeSessionStartDate(LocalDateTime.of(2026, 7, 18, 5, 59)))
            .isEqualTo(LocalDate.of(2026, 7, 17));
        assertThat(UsdKrwIntradaySession.activeSessionStartDate(LocalDateTime.of(2026, 7, 18, 6, 0)))
            .isNull();
    }

    @Test
    void usesStandardSessionFromSevenToNextSeven() {
        LocalDate sessionStartDate = LocalDate.of(2026, 12, 14);

        assertThat(UsdKrwIntradaySession.startTime(sessionStartDate)).isEqualTo(LocalTime.of(7, 0));
        assertThat(UsdKrwIntradaySession.startDateTime(sessionStartDate)).isEqualTo(LocalDateTime.of(2026, 12, 14, 7, 0));
        assertThat(UsdKrwIntradaySession.endDateTime(sessionStartDate)).isEqualTo(LocalDateTime.of(2026, 12, 15, 7, 0));
    }
}
