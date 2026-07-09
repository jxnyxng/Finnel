package com.example.krwwatcher.external;

import java.net.URI;
import java.time.format.DateTimeFormatter;
import java.time.LocalDate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Optional;

import com.example.krwwatcher.config.ExternalApiProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.client.RestClient;

@Component
public class BokPortalClient {

    private static final DateTimeFormatter BOK_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy.MM.dd");
    private static final Pattern ROW_PATTERN = Pattern.compile("<li class=\"bbsRowCls\">(?<row>.*?)</li>", Pattern.DOTALL);
    private static final Pattern DATE_PATTERN = Pattern.compile("<span class=\"date\"><span class=\"sr-only\">등록일</span>(?<date>\\d{4}\\.\\d{2}\\.\\d{2})</span>");
    private static final Pattern LINK_PATTERN = Pattern.compile("<a href=\"(?<href>[^\"]*menuNo=200789[^\"]*)\" class=\"title\">(?<title>.*?)</a>", Pattern.DOTALL);

    private final ExternalApiProperties properties;
    private final RestClient restClient;

    public BokPortalClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.bok().baseUrl()).build();
    }

    public Optional<BokDocumentPayload> fetchLatestMpcMinutesSignal() {
        String body = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/portal/singl/newsData/listCont.do")
                .queryParam("pageIndex", 1)
                .queryParam("targetDepth", 4)
                .queryParam("menuNo", 200789)
                .queryParam("syncMenuChekKey", 1)
                .queryParam("searchCnd", 2)
                .queryParam("searchKwd", "의사록")
                .queryParam("sort", 1)
                .queryParam("pageUnit", 10)
                .build())
            .retrieve()
            .body(String.class);

        if (!StringUtils.hasText(body)) {
            return Optional.empty();
        }

        Matcher rowMatcher = ROW_PATTERN.matcher(body);
        while (rowMatcher.find()) {
            String row = rowMatcher.group("row");
            if (!row.contains("의사팀")) {
                continue;
            }

            Matcher linkMatcher = LINK_PATTERN.matcher(row);
            Matcher dateMatcher = DATE_PATTERN.matcher(row);
            if (linkMatcher.find() && dateMatcher.find()) {
                String title = normalizeText(linkMatcher.group("title"));
                if (!title.contains("금융통화위원회 의사록")) {
                    continue;
                }
                return Optional.of(new BokDocumentPayload(
                    LocalDate.parse(dateMatcher.group("date"), BOK_DATE_FORMATTER),
                    title,
                    absoluteUrl(linkMatcher.group("href"))
                ));
            }
        }

        return Optional.of(new BokDocumentPayload(
            LocalDate.now(),
            "금융통화위원회 의사록 공식 목록",
            absoluteUrl(properties.bok().mpcMinutesPath())
        ));
    }

    private String absoluteUrl(String path) {
        URI uri = URI.create(path.replace("&amp;", "&"));
        if (uri.isAbsolute()) {
            return uri.toString();
        }
        return UriComponentsBuilder.fromUriString(properties.bok().baseUrl())
            .replacePath(uri.getPath())
            .replaceQuery(uri.getQuery())
            .toUriString();
    }

    private String normalizeText(String value) {
        return value
            .replaceAll("<!--.*?-->", "")
            .replaceAll("<[^>]+>", "")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replaceAll("\\s+", " ")
            .trim();
    }

    public record BokDocumentPayload(LocalDate baseDate, String title, String url) {
    }
}
