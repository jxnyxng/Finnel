package com.example.krwwatcher.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import com.example.krwwatcher.external.KasiSpecialDayClient;
import org.springframework.stereotype.Service;

@Service
public class BusinessDayService {

    private final KasiSpecialDayClient kasiSpecialDayClient;
    private final ConcurrentMap<YearMonth, Set<LocalDate>> koreanPublicHolidayCache = new ConcurrentHashMap<>();

    public BusinessDayService(KasiSpecialDayClient kasiSpecialDayClient) {
        this.kasiSpecialDayClient = kasiSpecialDayClient;
    }

    public boolean isKoreanBusinessDay(LocalDate date) {
        return isWeekday(date) && !isKoreanPublicHoliday(date);
    }

    public LocalDate previousKoreanBusinessDay(LocalDate date) {
        LocalDate candidate = date.minusDays(1);
        while (!isKoreanBusinessDay(candidate)) {
            candidate = candidate.minusDays(1);
        }
        return candidate;
    }

    private boolean isWeekday(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        return dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY;
    }

    private boolean isKoreanPublicHoliday(LocalDate date) {
        if (!kasiSpecialDayClient.isConfigured()) {
            return false;
        }

        YearMonth yearMonth = YearMonth.from(date);
        try {
            Set<LocalDate> holidays = koreanPublicHolidayCache.computeIfAbsent(
                yearMonth,
                kasiSpecialDayClient::fetchKoreanPublicHolidays
            );
            return holidays.contains(date);
        } catch (RuntimeException exception) {
            return false;
        }
    }
}
