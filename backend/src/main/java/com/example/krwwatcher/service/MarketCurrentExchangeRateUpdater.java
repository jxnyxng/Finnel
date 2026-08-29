package com.example.krwwatcher.service;

import java.time.LocalDate;
import java.time.ZoneId;

import com.example.krwwatcher.external.TwelveDataClient;

// Converts Twelve Data current exchange payloads into current exchange rate storage rows.
class MarketCurrentExchangeRateUpdater {

    private final MarketExchangeRateDao exchangeRateDao;
    private final ZoneId baseDateZone;

    MarketCurrentExchangeRateUpdater(MarketExchangeRateDao exchangeRateDao, ZoneId baseDateZone) {
        this.exchangeRateDao = exchangeRateDao;
        this.baseDateZone = baseDateZone;
    }

    int upsert(TwelveDataExchangeSpec spec, TwelveDataClient.CurrentExchangeRatePayload payload) {
        exchangeRateDao.upsertCurrentExchangeRate(
            LocalDate.ofInstant(payload.observedAt(), baseDateZone),
            spec.currencyCode(),
            spec.currencyName(),
            spec.toDisplayRate(payload.rate()),
            "TWELVE_DATA:exchange_rate:" + spec.symbol(),
            payload.observedAt()
        );
        return 1;
    }
}
