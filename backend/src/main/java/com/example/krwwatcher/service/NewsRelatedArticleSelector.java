package com.example.krwwatcher.service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import com.example.krwwatcher.service.news.NewsArticleText;
import org.springframework.util.StringUtils;

// Selects and ranks news articles for related-news banners.
class NewsRelatedArticleSelector {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");

    private final NewsArticleText newsArticleText;

    NewsRelatedArticleSelector(NewsArticleText newsArticleText) {
        this.newsArticleText = newsArticleText;
    }

    List<NewsService.NewsArticle> select(List<NewsService.NewsArticle> articles, String topic, int limit) {
        return buildRelatedBannerArticles(rankRelatedArticleCandidates(articles, relatedKeywords(topic)), limit);
    }

    List<String> relatedKeywords(String topic) {
        if ("indicators".equals(topic)) {
            return List.of("한국은행", "기준금리", "금리", "FOMC", "연준", "외환보유액", "경상수지", "무역수지", "물가", "재정", "CDS");
        }

        return List.of("원달러", "환율", "달러", "원화", "외환", "외환시장", "달러 인덱스", "연준", "FOMC");
    }

    private List<RelatedArticleCandidate> rankRelatedArticleCandidates(List<NewsService.NewsArticle> articles, List<String> keywords) {
        return articles.stream()
            .map(article -> toRelatedArticleCandidate(article, scoreRelatedArticle(article, keywords)))
            .sorted(Comparator
                .comparingInt((RelatedArticleCandidate candidate) -> candidate.bannerScore).reversed()
                .thenComparing(candidate -> candidate.article.publishedAt(), Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(candidate -> candidate.article.fetchedAt(), Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
    }

    private List<NewsService.NewsArticle> buildRelatedBannerArticles(List<RelatedArticleCandidate> rankedCandidates, int limit) {
        List<NewsService.NewsArticle> selectedArticles = new ArrayList<>();
        for (RelatedArticleCandidate candidate : rankedCandidates) {
            if (selectedArticles.size() >= limit) {
                break;
            }
            addUniqueRelatedArticle(selectedArticles, candidate.article(), limit);
        }

        return selectedArticles;
    }

    private void addUniqueRelatedArticle(List<NewsService.NewsArticle> articles, NewsService.NewsArticle article, int limit) {
        if (articles.size() >= limit || containsSameRelatedArticle(articles, article)) {
            return;
        }

        articles.add(article);
    }

    private boolean containsSameRelatedArticle(List<NewsService.NewsArticle> articles, NewsService.NewsArticle article) {
        String articleIdentity = relatedArticleIdentity(article);
        for (NewsService.NewsArticle currentArticle : articles) {
            if (articleIdentity.equals(relatedArticleIdentity(currentArticle))) {
                return true;
            }
        }
        return false;
    }

    private String relatedArticleIdentity(NewsService.NewsArticle article) {
        String url = newsArticleText.canonicalizeUrl(newsArticleText.firstText(article.link(), article.originLink()));
        if (StringUtils.hasText(url)) {
            return "url:" + url;
        }

        String title = newsArticleText.normalizeTitle(article.title());
        String publishedDate = article.publishedAt() == null ? "" : LocalDate.ofInstant(article.publishedAt(), SEOUL_ZONE).toString();
        return "title:" + title + ":" + publishedDate;
    }

    private RelatedArticleCandidate toRelatedArticleCandidate(NewsService.NewsArticle article, int relatedScore) {
        int freshnessScore = freshnessScore(article.publishedAt());
        int textLength = articleTextLength(article);
        int imageScore = StringUtils.hasText(article.imageUrl()) ? 12 : 0;
        int bannerScore = relatedScore * 10 + freshnessScore + Math.min(12, textLength / 70) + imageScore;
        return new RelatedArticleCandidate(article, relatedScore, bannerScore);
    }

    private int scoreRelatedArticle(NewsService.NewsArticle article, List<String> keywords) {
        String title = article.title() == null ? "" : article.title();
        String description = article.description() == null ? "" : article.description();
        String categoryName = article.categoryName() == null ? "" : article.categoryName();
        String queryText = article.queryText() == null ? "" : article.queryText();
        int score = 0;

        for (String keyword : keywords) {
            if (title.contains(keyword)) {
                score += 5;
            }
            if (description.contains(keyword)) {
                score += 2;
            }
            if (categoryName.contains(keyword) || queryText.contains(keyword)) {
                score += 3;
            }
        }

        if (StringUtils.hasText(article.imageUrl())) {
            score += 8;
        }

        score += freshnessScore(article.publishedAt());
        score += Math.min(10, articleTextLength(article) / 80);

        return score;
    }

    private int freshnessScore(Instant publishedAt) {
        if (publishedAt == null) {
            return 0;
        }

        long ageHours = Math.max(0, Duration.between(publishedAt, Instant.now()).toHours());
        if (ageHours <= 6) {
            return 30;
        }
        if (ageHours <= 24) {
            return 24;
        }
        if (ageHours <= 72) {
            return 16;
        }
        if (ageHours <= 168) {
            return 8;
        }
        return 0;
    }

    private int articleTextLength(NewsService.NewsArticle article) {
        return nullToEmpty(article.title()).length()
            + nullToEmpty(article.description()).length()
            + nullToEmpty(article.aiSummary()).length();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private record RelatedArticleCandidate(
        NewsService.NewsArticle article,
        int relatedScore,
        int bannerScore
    ) {
    }
}
