package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.time.LocalDate;

// Latest daily exchange rate projection for sync decisions.
record MarketDataLatestExchangeRate(LocalDate baseDate, BigDecimal rate) {
}
