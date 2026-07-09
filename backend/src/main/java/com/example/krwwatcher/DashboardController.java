package com.example.krwwatcher;

import com.example.krwwatcher.service.DashboardService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/daily")
    public DashboardService.DailyDashboardResponse daily() {
        return dashboardService.daily();
    }

    @GetMapping("/domestic-indicators/{code}/history")
    public DashboardService.DomesticIndicatorHistoryResponse domesticIndicatorHistory(
        @PathVariable String code,
        @RequestParam(defaultValue = "3Y") String range
    ) {
        return dashboardService.domesticIndicatorHistory(code, range);
    }
}
