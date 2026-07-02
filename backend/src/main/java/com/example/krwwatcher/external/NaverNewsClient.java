package com.example.krwwatcher.external;

import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class NaverNewsClient {

    private final ExternalApiProperties properties;
    private final RestClient restClient;

    public NaverNewsClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.naver().baseUrl()).build();
    }

    public boolean isConfigured() {
        ExternalApiProperties.Naver config = properties.naver();
        return StringUtils.hasText(config.clientId()) && StringUtils.hasText(config.clientSecret());
    }

    public List<NaverNewsItem> search(String query, int display, String sort) {
        return search(query, display, 1, sort);
    }

    public List<NaverNewsItem> search(String query, int display, int start, String sort) {
        if (!isConfigured()) {
            return List.of();
        }

        NaverNewsSearchResponse response = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/v1/search/news.json")
                .queryParam("query", query)
                .queryParam("display", display)
                .queryParam("start", start)
                .queryParam("sort", sort)
                .build())
            .header("X-Naver-Client-Id", properties.naver().clientId())
            .header("X-Naver-Client-Secret", properties.naver().clientSecret())
            .retrieve()
            .body(NaverNewsSearchResponse.class);

        if (response == null || response.items() == null) {
            return List.of();
        }

        return response.items();
    }

    public Instant parsePublishedAt(String pubDate) {
        if (!StringUtils.hasText(pubDate)) {
            return null;
        }

        return ZonedDateTime.parse(pubDate, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
    }

    public record NaverNewsSearchResponse(
        @JsonProperty("lastBuildDate")
        String lastBuildDate,
        int total,
        int start,
        int display,
        List<NaverNewsItem> items
    ) {
    }

    public record NaverNewsItem(
        String title,
        @JsonProperty("originallink")
        String originLink,
        String link,
        String description,
        String pubDate
    ) {
    }
}
