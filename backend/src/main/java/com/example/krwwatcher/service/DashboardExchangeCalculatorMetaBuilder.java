// Builds dashboard exchange-calculator date bounds from available FX rates.
package com.example.krwwatcher.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

class DashboardExchangeCalculatorMetaBuilder {

    DashboardService.ExchangeRateCalculatorMeta exchangeRateCalculatorMeta(
        List<DashboardService.ForeignExchangeRate> rates,
        LocalDate fallbackLatestDate
    ) {
        LocalDate latestAllowedDate = rates.stream()
            .map(DashboardService.ForeignExchangeRate::historyEndDate)
            .filter(Objects::nonNull)
            .max(LocalDate::compareTo)
            .orElse(fallbackLatestDate);
        LocalDate earliestAllowedDate = rates.stream()
            .map(DashboardService.ForeignExchangeRate::historyStartDate)
            .filter(Objects::nonNull)
            .min(LocalDate::compareTo)
            .orElse(latestAllowedDate.minusYears(5));
        return new DashboardService.ExchangeRateCalculatorMeta(earliestAllowedDate, latestAllowedDate);
    }
}
