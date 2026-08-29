package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.Test;

class MarketDailyBackfillDateSelectorTest {

    private final MarketDailyBackfillDateSelector selector = new MarketDailyBackfillDateSelector();

    @Test
    void selectsOnlyMissingBusinessDatesInRangeOrder() {
        LocalDate startDate = LocalDate.of(2026, 8, 24);
        LocalDate endDate = LocalDate.of(2026, 8, 29);
        Set<LocalDate> existingDates = Set.of(LocalDate.of(2026, 8, 25));

        assertThat(selector.selectMissingBusinessDates(
            startDate,
            endDate,
            existingDates,
            date -> switch (date.getDayOfWeek()) {
                case SATURDAY, SUNDAY -> BusinessDayService.KoreanBusinessDayStatus.NON_BUSINESS_DAY;
                default -> BusinessDayService.KoreanBusinessDayStatus.BUSINESS_DAY;
            }
        ))
            .containsExactly(
                LocalDate.of(2026, 8, 24),
                LocalDate.of(2026, 8, 26),
                LocalDate.of(2026, 8, 27),
                LocalDate.of(2026, 8, 28)
            );
    }

    @Test
    void excludesNonBusinessDayStatus() {
        LocalDate startDate = LocalDate.of(2026, 8, 24);
        LocalDate endDate = LocalDate.of(2026, 8, 26);

        assertThat(selector.selectMissingBusinessDates(
            startDate,
            endDate,
            Set.of(),
            date -> date.equals(LocalDate.of(2026, 8, 25))
                ? BusinessDayService.KoreanBusinessDayStatus.NON_BUSINESS_DAY
                : BusinessDayService.KoreanBusinessDayStatus.BUSINESS_DAY
        ))
            .containsExactly(LocalDate.of(2026, 8, 24), LocalDate.of(2026, 8, 26));
    }
}
