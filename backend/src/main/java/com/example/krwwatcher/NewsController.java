package com.example.krwwatcher;

import java.time.LocalDate;

import com.example.krwwatcher.service.NewsService;
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

    public NewsController(NewsService newsService) {
        this.newsService = newsService;
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
        @RequestParam(defaultValue = "9") int limit
    ) {
        return newsService.related(topic, limit);
    }

    @PostMapping("/sync")
    public NewsService.NewsSyncResult sync() {
        return newsService.syncNews();
    }
}
