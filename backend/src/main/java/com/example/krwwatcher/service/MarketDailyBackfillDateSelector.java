package com.example.krwwatcher.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

// Selects missing Korean business dates eligible for daily exchange backfill.
class MarketDailyBackfillDateSelector {

    List<LocalDate> selectMissingBusinessDates(
        LocalDate startDate,
        LocalDate endDate,
        Set<LocalDate> existingDates,
        Function<LocalDate, BusinessDayService.KoreanBusinessDayStatus> businessDayStatus
    ) {
        return startDate.datesUntil(endDate.plusDays(1))
            .filter(date -> businessDayStatus.apply(date) == BusinessDayService.KoreanBusinessDayStatus.BUSINESS_DAY)
            .filter(date -> !existingDates.contains(date))
            .toList();
    }
}
