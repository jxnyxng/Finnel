package com.example.krwwatcher;

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
        @RequestParam(defaultValue = "30") int limit
    ) {
        return newsService.latest(category, limit);
    }

    @PostMapping("/sync")
    public NewsService.NewsSyncResult sync() {
        return newsService.syncNews();
    }
}
