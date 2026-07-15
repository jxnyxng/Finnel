package com.example.krwwatcher;

import com.example.krwwatcher.service.GovernmentBriefingService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/government-briefings")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
public class GovernmentBriefingController {

    private final GovernmentBriefingService governmentBriefingService;

    public GovernmentBriefingController(GovernmentBriefingService governmentBriefingService) {
        this.governmentBriefingService = governmentBriefingService;
    }

    @GetMapping
    public GovernmentBriefingService.GovernmentBriefingResponse latest(
        @RequestParam(defaultValue = "all") String category,
        @RequestParam(required = false) java.time.LocalDate from,
        @RequestParam(required = false) java.time.LocalDate to,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "12") int pageSize,
        @RequestParam(required = false) String keyword
    ) {
        return governmentBriefingService.latest(category, from, to, page, pageSize, keyword);
    }

    @PostMapping("/sync")
    public GovernmentBriefingService.GovernmentBriefingSyncResult sync() {
        return governmentBriefingService.syncLatest();
    }

    @PostMapping("/backfill")
    public GovernmentBriefingService.GovernmentBriefingSyncResult backfill(@RequestParam(defaultValue = "12") int months) {
        return governmentBriefingService.backfill(months);
    }
}
