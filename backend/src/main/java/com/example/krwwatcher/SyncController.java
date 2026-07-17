package com.example.krwwatcher;

import com.example.krwwatcher.service.MarketDataSyncService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sync")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
public class SyncController {

    private final MarketDataSyncService marketDataSyncService;

    public SyncController(MarketDataSyncService marketDataSyncService) {
        this.marketDataSyncService = marketDataSyncService;
    }

    @PostMapping("/market-data")
    public MarketDataSyncService.SyncResult syncMarketData() {
        return marketDataSyncService.requestManualSync();
    }

    @PostMapping("/intraday-exchange")
    public MarketDataSyncService.SyncResult syncIntradayExchange() {
        return marketDataSyncService.requestIntradayRefresh();
    }

    @PostMapping("/daily-exchange/backfill")
    public MarketDataSyncService.SyncResult backfillDailyExchange() {
        return marketDataSyncService.requestDailyBackfill();
    }

    @PostMapping("/exchange-rates/history/backfill")
    public MarketDataSyncService.SyncResult backfillExchangeRateHistory() {
        return marketDataSyncService.requestExchangeRateHistoryBackfill();
    }

    @GetMapping("/market-data/status")
    public MarketDataSyncService.SyncStatus syncMarketDataStatus() {
        return marketDataSyncService.status();
    }

    @GetMapping("/intraday-exchange/status")
    public MarketDataSyncService.SyncStatus syncIntradayExchangeStatus() {
        return marketDataSyncService.intradayStatus();
    }

    @GetMapping("/daily-exchange/backfill/status")
    public MarketDataSyncService.SyncStatus dailyExchangeBackfillStatus() {
        return marketDataSyncService.dailyBackfillStatus();
    }

    @GetMapping("/exchange-rates/history/backfill/status")
    public MarketDataSyncService.SyncStatus exchangeRateHistoryBackfillStatus() {
        return marketDataSyncService.exchangeRateHistoryBackfillStatus();
    }
}
