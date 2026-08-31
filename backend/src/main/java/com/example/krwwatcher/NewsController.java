package com.example.krwwatcher;

import java.time.LocalDate;

import com.example.krwwatcher.batch.content.NewsBackfillJobLauncher;
import com.example.krwwatcher.service.NewsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/news")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
public class NewsController {

    private final NewsService newsService;
    private final NewsBackfillJobLauncher backfillJobLauncher;

    public NewsController(NewsService newsService) {
        this(newsService, null);
    }

    @Autowired
    public NewsController(NewsService newsService, NewsBackfillJobLauncher backfillJobLauncher) {
        this.newsService = newsService;
        this.backfillJobLauncher = backfillJobLauncher;
    }

    @GetMapping
    public NewsService.NewsResponse latest(
        @RequestParam(defaultValue = "all") String category,
        @RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to,
        @RequestParam(required = false) String keyword,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int pageSize
    ) {
        return newsService.latest(category, from, to, keyword, page, pageSize);
    }

    @GetMapping("/related")
    public NewsService.RelatedNewsResponse related(
        @RequestParam(defaultValue = "exchange") String topic,
        @RequestParam(defaultValue = "30") int limit
    ) {
        return newsService.related(topic, limit);
    }

    @PostMapping("/sync")
    public NewsService.NewsSyncResult sync() {
        if (backfillJobLauncher != null) {
            return backfillJobLauncher.runManualBackfill();
        }

        return newsService.syncNews();
    }
}
