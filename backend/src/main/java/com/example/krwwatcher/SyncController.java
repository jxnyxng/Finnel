package com.example.krwwatcher;

import com.example.krwwatcher.service.MarketDataSyncService;
import com.example.krwwatcher.service.SyncPostAccessService;
import jakarta.servlet.http.HttpServletRequest;
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
    private final SyncPostAccessService syncPostAccessService;

    public SyncController(MarketDataSyncService marketDataSyncService, SyncPostAccessService syncPostAccessService) {
        this.marketDataSyncService = marketDataSyncService;
        this.syncPostAccessService = syncPostAccessService;
    }

    @PostMapping("/market-data")
    public MarketDataSyncService.SyncResult syncMarketData(HttpServletRequest request) {
        return runAuthorizedSyncPost(request, "MARKET_DATA_SYNC", marketDataSyncService::requestManualSync);
    }

    @PostMapping("/intraday-exchange")
    public MarketDataSyncService.SyncResult syncIntradayExchange(HttpServletRequest request) {
        return runAuthorizedSyncPost(request, "INTRADAY_EXCHANGE_SYNC", marketDataSyncService::requestIntradayRefresh);
    }

    @PostMapping("/daily-exchange/backfill")
    public MarketDataSyncService.SyncResult backfillDailyExchange(HttpServletRequest request) {
        return runAuthorizedSyncPost(request, "DAILY_EXCHANGE_BACKFILL", marketDataSyncService::requestDailyBackfill);
    }

    @PostMapping("/exchange-rates/history/backfill")
    public MarketDataSyncService.SyncResult backfillExchangeRateHistory(HttpServletRequest request) {
        return runAuthorizedSyncPost(request, "EXCHANGE_RATE_HISTORY_BACKFILL", marketDataSyncService::requestExchangeRateHistoryBackfill);
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

    private MarketDataSyncService.SyncResult runAuthorizedSyncPost(
        HttpServletRequest request,
        String operation,
        java.util.function.Supplier<MarketDataSyncService.SyncResult> supplier
    ) {
        SyncPostAccessService.SyncPostCaller caller = syncPostAccessService.authorize(request, operation);
        try {
            MarketDataSyncService.SyncResult result = supplier.get();
            syncPostAccessService.auditSuccess(request, operation, caller, result);
            return result;
        } catch (RuntimeException exception) {
            syncPostAccessService.auditFailure(request, operation, caller, exception);
            throw exception;
        }
    }
}
