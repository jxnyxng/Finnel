package com.example.krwwatcher.external;

import java.io.StringReader;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.xml.parsers.DocumentBuilderFactory;

import com.example.krwwatcher.config.ExternalApiProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.ErrorHandler;
import org.xml.sax.InputSource;
import org.xml.sax.SAXParseException;

@Component
public class PolicyBriefingClient {

    private static final String POLICY_NEWS_PATH = "/1371000/policyNewsService2/policyNewsList2";
    private static final int LATEST_LOOKBACK_DAYS = 2;
    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter DATE_FORMATTER = new DateTimeFormatterBuilder()
        .appendPattern("yyyy-MM-dd")
        .optionalStart()
        .appendPattern(" HH:mm:ss")
        .optionalEnd()
        .parseDefaulting(ChronoField.HOUR_OF_DAY, 0)
        .parseDefaulting(ChronoField.MINUTE_OF_HOUR, 0)
        .parseDefaulting(ChronoField.SECOND_OF_MINUTE, 0)
        .toFormatter();
    private static final DateTimeFormatter US_DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm:ss");
    private static final Pattern LENIENT_ITEM_PATTERN = Pattern.compile("(?is)<(?:NewsItem|item)\\b[^>]*>(.*?)</(?:NewsItem|item)>");

    private final ExternalApiProperties properties;
    private final RestClient restClient;

    public PolicyBriefingClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.policyBriefing().baseUrl()).build();
    }

    public boolean isConfigured() {
        return StringUtils.hasText(properties.policyBriefing().apiKey())
            && !"replace-me".equalsIgnoreCase(properties.policyBriefing().apiKey().trim());
    }

    public List<PolicyBriefingPayload> fetchLatest(int pageNo, int numOfRows) {
        LocalDate endDate = LocalDate.now(SEOUL_ZONE);
        LocalDate startDate = endDate.minusDays(LATEST_LOOKBACK_DAYS);
        return fetchRange(startDate, endDate);
    }

    public List<PolicyBriefingPayload> fetchRange(LocalDate startDate, LocalDate endDate) {
        if (!isConfigured()) {
            return List.of();
        }

        String body = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path(POLICY_NEWS_PATH)
                .queryParam("serviceKey", normalizedApiKey())
                .queryParam("startDate", startDate.format(DateTimeFormatter.BASIC_ISO_DATE))
                .queryParam("endDate", endDate.format(DateTimeFormatter.BASIC_ISO_DATE))
                .build())
            .retrieve()
            .body(String.class);
        return parseItems(body);
    }

    static List<PolicyBriefingPayload> parseItems(String body) {
        if (!StringUtils.hasText(body)) {
            return List.of();
        }

        String xmlBody = normalizeXmlBody(body);
        if (!xmlBody.startsWith("<")) {
            return List.of();
        }

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            javax.xml.parsers.DocumentBuilder builder = factory.newDocumentBuilder();
            builder.setErrorHandler(new SilentXmlErrorHandler());
            Element root = builder
                .parse(new InputSource(new StringReader(xmlBody)))
                .getDocumentElement();
            validateSuccessResponse(root);
            List<PolicyBriefingPayload> payloads = new ArrayList<>();
            NodeList items = root.getElementsByTagName("item");
            if (items.getLength() == 0) {
                items = root.getElementsByTagName("NewsItem");
            }
            for (int index = 0; index < items.getLength(); index++) {
                Node node = items.item(index);
                if (node instanceof Element element) {
                    PolicyBriefingPayload payload = parseItem(element);
                    if (StringUtils.hasText(payload.title())) {
                        payloads.add(payload);
                    }
                }
            }
            return payloads.isEmpty() ? parseItemsLeniently(xmlBody) : payloads;
        } catch (IllegalStateException exception) {
            throw exception;
        } catch (Exception ignored) {
            return parseItemsLeniently(xmlBody);
        }
    }

    private static void validateSuccessResponse(Element root) {
        String resultCode = firstText(root, "resultCode");
        if (!StringUtils.hasText(resultCode) || "0".equals(resultCode.trim())) {
            return;
        }
        String resultMessage = firstText(root, "resultMsg");
        throw new IllegalStateException("Policy briefing API error: " + resultCode.trim()
            + (StringUtils.hasText(resultMessage) ? " " + resultMessage.trim() : ""));
    }

    private static PolicyBriefingPayload parseItem(Element item) {
        String title = firstText(item, "Title", "title");
        String subtitle = joinTexts(
            firstText(item, "SubTitle1", "subtitle1"),
            firstText(item, "SubTitle2", "subtitle2"),
            firstText(item, "SubTitle3", "subtitle3")
        );
        String body = firstText(item, "DataContents", "Contents", "Content", "content", "Body");
        String ministry = firstText(item, "MinisterCode", "MinisterName", "DeptName", "Department", "ministry");
        String category = firstText(item, "GroupingCode", "Category", "category");
        Instant publishedAt = parsePublishedAt(firstText(item, "ApproveDate", "ModifyDate", "RegDate", "Date", "date"));
        String thumbnailUrl = firstText(item, "ThumbnailUrl", "ThumbnailURL", "thumbnailUrl");
        String imageUrl = firstText(item, "OriginalimgUrl", "OriginalImgUrl", "ImageUrl", "imageUrl");
        String originalUrl = firstText(item, "OriginalUrl", "OriginalURL", "Link", "link");
        String koglType = firstText(item, "KoglType", "koglType");

        return new PolicyBriefingPayload(
            clean(title),
            clean(subtitle),
            clean(body),
            clean(ministry),
            clean(category),
            publishedAt,
            clean(thumbnailUrl),
            clean(imageUrl),
            clean(originalUrl),
            clean(koglType)
        );
    }

    private static List<PolicyBriefingPayload> parseItemsLeniently(String xmlBody) {
        List<PolicyBriefingPayload> payloads = new ArrayList<>();
        Matcher matcher = LENIENT_ITEM_PATTERN.matcher(xmlBody);
        while (matcher.find()) {
            PolicyBriefingPayload payload = parseItemBlock(matcher.group(1));
            if (StringUtils.hasText(payload.title())) {
                payloads.add(payload);
            }
        }
        return payloads;
    }

    private static PolicyBriefingPayload parseItemBlock(String item) {
        String title = firstText(item, "Title", "title");
        String subtitle = joinTexts(
            firstText(item, "SubTitle1", "subtitle1"),
            firstText(item, "SubTitle2", "subtitle2"),
            firstText(item, "SubTitle3", "subtitle3")
        );
        String body = firstText(item, "DataContents", "Contents", "Content", "content", "Body");
        String ministry = firstText(item, "MinisterCode", "MinisterName", "DeptName", "Department", "ministry");
        String category = firstText(item, "GroupingCode", "Category", "category");
        Instant publishedAt = parsePublishedAt(firstText(item, "ApproveDate", "ModifyDate", "RegDate", "Date", "date"));
        String thumbnailUrl = firstText(item, "ThumbnailUrl", "ThumbnailURL", "thumbnailUrl");
        String imageUrl = firstText(item, "OriginalimgUrl", "OriginalImgUrl", "ImageUrl", "imageUrl");
        String originalUrl = firstText(item, "OriginalUrl", "OriginalURL", "Link", "link");
        String koglType = firstText(item, "KoglType", "koglType");

        return new PolicyBriefingPayload(
            clean(title),
            clean(subtitle),
            clean(body),
            clean(ministry),
            clean(category),
            publishedAt,
            clean(thumbnailUrl),
            clean(imageUrl),
            clean(originalUrl),
            clean(koglType)
        );
    }

    private static String firstText(Element element, String... names) {
        for (String name : names) {
            NodeList nodes = element.getElementsByTagName(name);
            if (nodes.getLength() > 0) {
                String value = nodes.item(0).getTextContent();
                if (StringUtils.hasText(value)) {
                    return value;
                }
            }
        }
        return null;
    }

    private static String firstText(String item, String... names) {
        for (String name : names) {
            Matcher matcher = Pattern.compile("(?is)<" + Pattern.quote(name) + "\\b[^>]*>(.*?)</" + Pattern.quote(name) + ">").matcher(item);
            if (matcher.find()) {
                String value = unwrapCdata(matcher.group(1));
                if (StringUtils.hasText(value)) {
                    return value;
                }
            }
        }
        return null;
    }

    private static String unwrapCdata(String value) {
        String trimmed = value.trim();
        if (trimmed.startsWith("<![CDATA[") && trimmed.endsWith("]]>")) {
            return trimmed.substring("<![CDATA[".length(), trimmed.length() - "]]>".length());
        }
        return value;
    }

    private static String joinTexts(String... values) {
        List<String> texts = new ArrayList<>();
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                texts.add(value.trim());
            }
        }
        return texts.isEmpty() ? null : String.join(" ", texts);
    }

    private static Instant parsePublishedAt(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        String normalized = value.trim().replace('.', '-').replace('/', '-');
        try {
            return LocalDate.parse(normalized.length() > 10 ? normalized.substring(0, 10) : normalized, DateTimeFormatter.ISO_LOCAL_DATE)
                .atStartOfDay(SEOUL_ZONE)
                .toInstant();
        } catch (RuntimeException ignored) {
            try {
                return DATE_FORMATTER.parse(normalized, LocalDate::from).atStartOfDay(SEOUL_ZONE).toInstant();
            } catch (RuntimeException ignoredAgain) {
                try {
                    return java.time.LocalDateTime.parse(value.trim(), US_DATE_TIME_FORMATTER)
                        .atZone(SEOUL_ZONE)
                        .toInstant();
                } catch (RuntimeException ignoredThird) {
                    return null;
                }
            }
        }
    }

    private static String clean(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace('\u00a0', ' ')
            .replaceAll("<[^>]+>", " ")
            .replaceAll("\\s+", " ")
            .trim();
    }

    private static String normalizeXmlBody(String body) {
        String normalized = body.stripLeading();
        if (normalized.startsWith("\uFEFF")) {
            normalized = normalized.substring(1).stripLeading();
        }
        return normalized;
    }

    private String normalizedApiKey() {
        String apiKey = properties.policyBriefing().apiKey().trim();
        if (!apiKey.contains("%")) {
            return apiKey;
        }

        return URLDecoder.decode(apiKey, StandardCharsets.UTF_8);
    }

    public record PolicyBriefingPayload(
        String title,
        String subtitle,
        String body,
        String ministry,
        String category,
        Instant publishedAt,
        String thumbnailUrl,
        String imageUrl,
        String originalUrl,
        String koglType
    ) {
    }

    private static class SilentXmlErrorHandler implements ErrorHandler {
        @Override
        public void warning(SAXParseException exception) {
            // Ignore malformed upstream XML and keep sync resilient.
        }

        @Override
        public void error(SAXParseException exception) {
            // Ignore malformed upstream XML and keep sync resilient.
        }

        @Override
        public void fatalError(SAXParseException exception) throws SAXParseException {
            throw exception;
        }
    }
}
