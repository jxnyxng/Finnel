package com.example.krwwatcher.service.news;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.Locale;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

@Component
public class NewsArticleText {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");

    public String firstText(String first, String second) {
        return StringUtils.hasText(first) ? first : second;
    }

    public String buildDedupeKey(String canonicalUrl, String title, Instant publishedAt) {
        String normalizedTitle = normalizeTitle(title);
        String publishedDate = publishedAt == null ? "" : LocalDate.ofInstant(publishedAt, SEOUL_ZONE).toString();
        if (StringUtils.hasText(normalizedTitle)) {
            return sha256("title:" + normalizedTitle + ":" + publishedDate);
        }

        if (StringUtils.hasText(canonicalUrl)) {
            return sha256("url:" + canonicalUrl);
        }

        return null;
    }

    public String canonicalizeUrl(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        try {
            URI uri = new URI(value.trim());
            String scheme = uri.getScheme() == null ? "https" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost() == null ? null : uri.getHost().toLowerCase(Locale.ROOT);
            if (!StringUtils.hasText(host)) {
                return value.trim();
            }

            if (host.startsWith("www.")) {
                host = host.substring(4);
            }

            String path = uri.getRawPath();
            if (!StringUtils.hasText(path)) {
                path = "/";
            }
            while (path.length() > 1 && path.endsWith("/")) {
                path = path.substring(0, path.length() - 1);
            }

            return new URI(scheme, null, host, -1, path, null, null).toString();
        } catch (URISyntaxException | IllegalArgumentException exception) {
            return value.trim();
        }
    }

    public String normalizeTitle(String value) {
        String cleaned = cleanText(value);
        if (!StringUtils.hasText(cleaned)) {
            return "";
        }

        return cleaned.toLowerCase(Locale.ROOT)
            .replaceAll("\\[[^]]*]", " ")
            .replaceAll("\\([^)]*\\)", " ")
            .replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", " ")
            .trim()
            .replaceAll("\\s+", " ");
    }

    public String cleanText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        String withoutTags = value.replaceAll("<[^>]*>", "");
        return HtmlUtils.htmlUnescape(withoutTags).trim();
    }

    public String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
