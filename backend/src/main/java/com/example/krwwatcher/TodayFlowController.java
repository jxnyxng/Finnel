package com.example.krwwatcher;

import com.example.krwwatcher.service.DashboardService;
import com.example.krwwatcher.service.GovernmentBriefingService;
import com.example.krwwatcher.service.NewsService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/today-flow")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
public class TodayFlowController {

    private final DashboardService dashboardService;
    private final NewsService newsService;
    private final GovernmentBriefingService governmentBriefingService;

    public TodayFlowController(
        DashboardService dashboardService,
        NewsService newsService,
        GovernmentBriefingService governmentBriefingService
    ) {
        this.dashboardService = dashboardService;
        this.newsService = newsService;
        this.governmentBriefingService = governmentBriefingService;
    }

    @GetMapping
    public TodayFlowResponse todayFlow() {
        return new TodayFlowResponse(
            dashboardService.daily(),
            newsService.latest("all", null, null, null, 1, 10),
            governmentBriefingService.latest("all", null, null, 1, 12, null)
        );
    }

    public record TodayFlowResponse(
        DashboardService.DailyDashboardResponse dashboard,
        NewsService.NewsResponse news,
        GovernmentBriefingService.GovernmentBriefingResponse governmentBriefings
    ) {
    }
}
