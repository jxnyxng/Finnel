package com.example.krwwatcher.external;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Set;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class KasiSpecialDayClient {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.BASIC_ISO_DATE;

    private final ExternalApiProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public KasiSpecialDayClient(ExternalApiProperties properties, ObjectMapper objectMapper, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder.baseUrl(properties.kasi().baseUrl()).build();
    }

    public boolean isConfigured() {
        return StringUtils.hasText(properties.kasi().apiKey())
            && !"replace-me".equalsIgnoreCase(properties.kasi().apiKey().trim());
    }

    public Set<LocalDate> fetchKoreanPublicHolidays(YearMonth yearMonth) {
        if (!isConfigured()) {
            return Set.of();
        }

        String body = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/getHoliDeInfo")
                .queryParam("serviceKey", normalizedApiKey())
                .queryParam("solYear", yearMonth.getYear())
                .queryParam("solMonth", "%02d".formatted(yearMonth.getMonthValue()))
                .queryParam("_type", "json")
                .build())
            .retrieve()
            .body(String.class);

        if (!StringUtils.hasText(body)) {
            return Set.of();
        }

        try {
            return parseHolidayDates(body);
        } catch (IOException exception) {
            return Set.of();
        }
    }

    private Set<LocalDate> parseHolidayDates(String body) throws IOException {
        JsonNode items = objectMapper.readTree(body)
            .path("response")
            .path("body")
            .path("items")
            .path("item");
        if (items.isMissingNode() || items.isNull()) {
            return Set.of();
        }

        Set<LocalDate> holidays = new HashSet<>();
        if (items.isArray()) {
            for (JsonNode item : items) {
                addHolidayDate(holidays, item);
            }
        } else {
            addHolidayDate(holidays, items);
        }
        return holidays;
    }

    private void addHolidayDate(Set<LocalDate> holidays, JsonNode item) {
        if (!"Y".equalsIgnoreCase(item.path("isHoliday").asText())) {
            return;
        }

        String localDate = item.path("locdate").asText();
        if (!StringUtils.hasText(localDate)) {
            return;
        }

        try {
            holidays.add(LocalDate.parse(localDate, DATE_FORMATTER));
        } catch (RuntimeException ignored) {
            // Ignore malformed upstream rows and keep the calendar fallback usable.
        }
    }

    private String normalizedApiKey() {
        String apiKey = properties.kasi().apiKey().trim();
        if (!apiKey.contains("%")) {
            return apiKey;
        }

        return URLDecoder.decode(apiKey, StandardCharsets.UTF_8);
    }
}
