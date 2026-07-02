package com.example.krwwatcher.external;

import java.net.URI;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.HtmlUtils;

@Component
public class NewsImageClient {

    private static final int MAX_HTML_LENGTH = 200_000;
    private static final Pattern META_TAG_PATTERN = Pattern.compile("<meta\\s+[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern ATTRIBUTE_PATTERN = Pattern.compile("([a-zA-Z_:.-]+)\\s*=\\s*(['\"])(.*?)\\2", Pattern.CASE_INSENSITIVE);

    private final RestClient restClient;

    public NewsImageClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.clone().build();
    }

    public String fetchRepresentativeImage(String pageUrl) {
        if (!isHttpUrl(pageUrl)) {
            return null;
        }

        try {
            String html = restClient.get()
                .uri(pageUrl)
                .retrieve()
                .body(String.class);
            return extractImageUrl(pageUrl, html).orElse(null);
        } catch (IllegalArgumentException | RestClientException exception) {
            return null;
        }
    }

    private Optional<String> extractImageUrl(String pageUrl, String html) {
        if (!StringUtils.hasText(html)) {
            return Optional.empty();
        }

        String head = html.length() > MAX_HTML_LENGTH ? html.substring(0, MAX_HTML_LENGTH) : html;
        Matcher tagMatcher = META_TAG_PATTERN.matcher(head);
        while (tagMatcher.find()) {
            String image = getMetaImageContent(tagMatcher.group());
            if (StringUtils.hasText(image)) {
                return resolveImageUrl(pageUrl, HtmlUtils.htmlUnescape(image.trim()));
            }
        }

        return Optional.empty();
    }

    private String getMetaImageContent(String tag) {
        String property = null;
        String content = null;
        Matcher attributeMatcher = ATTRIBUTE_PATTERN.matcher(tag);
        while (attributeMatcher.find()) {
            String name = attributeMatcher.group(1).toLowerCase(Locale.ROOT);
            String value = attributeMatcher.group(3);
            if ("property".equals(name) || "name".equals(name)) {
                property = value.toLowerCase(Locale.ROOT);
            } else if ("content".equals(name)) {
                content = value;
            }
        }

        if ("og:image".equals(property) || "twitter:image".equals(property) || "twitter:image:src".equals(property)) {
            return content;
        }

        return null;
    }

    private Optional<String> resolveImageUrl(String pageUrl, String imageUrl) {
        try {
            URI resolved = URI.create(pageUrl).resolve(imageUrl);
            String value = resolved.toString();
            return isHttpUrl(value) ? Optional.of(value) : Optional.empty();
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private boolean isHttpUrl(String value) {
        if (!StringUtils.hasText(value)) {
            return false;
        }

        String lowerValue = value.toLowerCase(Locale.ROOT);
        return lowerValue.startsWith("https://") || lowerValue.startsWith("http://");
    }
}
