package com.example.krwwatcher.external;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class EcosClient {

    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyyMM");
    private static final BigDecimal THOUSAND = new BigDecimal("1000");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final ExternalApiProperties properties;
    private final RestClient restClient;
    private final ExternalApiRequestSupport requestSupport = new ExternalApiRequestSupport();

    public EcosClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.ecos().baseUrl()).build();
    }

    public List<EcosObservationPayload> fetchKoreanPolicyRates(LocalDate startDate, LocalDate endDate) {
        ExternalApiProperties.Ecos config = properties.ecos();
        if (!StringUtils.hasText(config.apiKey())) {
            return List.of();
        }

        return fetchRawObservations(
            config.koreanPolicyRateStatCode(),
            "D",
            startDate.format(DateTimeFormatter.BASIC_ISO_DATE),
            endDate.format(DateTimeFormatter.BASIC_ISO_DATE),
            config.koreanPolicyRateItemCode()
        ).stream()
            .map(item -> new EcosObservationPayload(
                LocalDate.parse(item.time(), DateTimeFormatter.BASIC_ISO_DATE),
                new BigDecimal(item.dataValue())
            ))
            .toList();
    }

    public List<EcosObservationPayload> fetchForeignReserves(YearMonth startMonth, YearMonth endMonth) {
        ExternalApiProperties.Ecos config = properties.ecos();
        if (!StringUtils.hasText(config.apiKey())) {
            return List.of();
        }

        return fetchRawObservations(
            config.foreignReservesStatCode(),
            "M",
            startMonth.format(MONTH_FORMATTER),
            endMonth.format(MONTH_FORMATTER),
            config.foreignReservesItemCode()
        ).stream()
            .map(item -> new EcosObservationPayload(
                YearMonth.parse(item.time(), MONTH_FORMATTER).atEndOfMonth(),
                new BigDecimal(item.dataValue()).divide(THOUSAND, 2, RoundingMode.HALF_UP)
            ))
            .toList();
    }

    public List<EcosObservationPayload> fetchStatisticObservations(String statCode, String cycle, YearMonth startMonth, YearMonth endMonth, String... itemCodes) {
        return fetchStatisticObservations(
            statCode,
            cycle,
            startMonth.format(MONTH_FORMATTER),
            endMonth.format(MONTH_FORMATTER),
            itemCodes
        );
    }

    public List<EcosObservationPayload> fetchStatisticObservations(String statCode, String cycle, String start, String end, String... itemCodes) {
        ExternalApiProperties.Ecos config = properties.ecos();
        if (!StringUtils.hasText(config.apiKey())) {
            return List.of();
        }

        return fetchRawObservations(
            statCode,
            cycle,
            start,
            end,
            itemCodes
        ).stream()
            .map(item -> new EcosObservationPayload(
                parseBaseDate(item.time(), cycle),
                new BigDecimal(item.dataValue())
            ))
            .toList();
    }

    private List<EcosObservation> fetchRawObservations(String statCode, String cycle, String start, String end, String... itemCodes) {
        return requestSupport.fetchResult(
            () -> restClient.get()
                .uri(uriBuilder -> uriBuilder
                    .path("/StatisticSearch/{apiKey}/json/kr/1/1000/{statCode}/{cycle}/{start}/{end}")
                    .path(itemPath(itemCodes))
                    .build(
                        properties.ecos().apiKey(),
                        statCode,
                        cycle,
                        start,
                        end
                    ))
                .retrieve()
                .body(String.class),
            EcosClient::parseRawObservations
        ).rowsOrThrow("ECOS " + statCode);
    }

    static FetchResult<EcosObservation> parseRawObservations(String response) {
        if (!StringUtils.hasText(response)) {
            return FetchResult.failure(FetchStatus.PARSE_ERROR, "ECOS response body is empty");
        }
        if (response.trim().startsWith("<")) {
            return FetchResult.failure(FetchStatus.PARSE_ERROR, "ECOS returned non-JSON response");
        }

        try {
            JsonNode root = OBJECT_MAPPER.readTree(response);
            JsonNode statisticSearch = root.path("StatisticSearch");
            if (statisticSearch.isMissingNode() || statisticSearch.isNull()) {
                JsonNode result = root.path("RESULT");
                if (!result.isMissingNode()) {
                    String code = result.path("CODE").asText();
                    String message = result.path("MESSAGE").asText("ECOS remote result");
                    return "INFO-200".equalsIgnoreCase(code)
                        ? FetchResult.success(List.of())
                        : FetchResult.failure(FetchStatus.REMOTE_ERROR, message);
                }
                return FetchResult.failure(FetchStatus.SCHEMA_MISMATCH, "ECOS response is missing StatisticSearch");
            }

            JsonNode rows = statisticSearch.path("row");
            if (rows.isMissingNode() || rows.isNull() || !rows.isArray()) {
                return FetchResult.failure(FetchStatus.SCHEMA_MISMATCH, "ECOS response is missing row array");
            }
            if (rows.isEmpty()) {
                return FetchResult.success(List.of());
            }

            List<EcosObservation> observations = new ArrayList<>();
            for (JsonNode row : rows) {
                String time = row.path("TIME").asText(null);
                String dataValue = row.path("DATA_VALUE").asText(null);
                if (!StringUtils.hasText(time) || !StringUtils.hasText(dataValue)) {
                    return FetchResult.failure(FetchStatus.SCHEMA_MISMATCH, "ECOS row is missing TIME or DATA_VALUE");
                }
                observations.add(new EcosObservation(time, dataValue));
            }

            return FetchResult.success(observations);
        } catch (RuntimeException | java.io.IOException exception) {
            return FetchResult.failure(FetchStatus.PARSE_ERROR, exception.getMessage());
        }
    }

    private String itemPath(String... itemCodes) {
        if (itemCodes == null || itemCodes.length == 0) {
            return "";
        }

        return "/" + String.join("/", Arrays.stream(itemCodes)
            .filter(StringUtils::hasText)
            .toList());
    }

    private LocalDate parseBaseDate(String time, String cycle) {
        if ("Q".equals(cycle)) {
            int year = Integer.parseInt(time.substring(0, 4));
            int quarter = Integer.parseInt(time.substring(5, 6));
            return YearMonth.of(year, quarter * 3).atEndOfMonth();
        }

        if ("A".equals(cycle)) {
            return LocalDate.of(Integer.parseInt(time), 12, 31);
        }

        if ("D".equals(cycle)) {
            return LocalDate.parse(time, DateTimeFormatter.BASIC_ISO_DATE);
        }

        return YearMonth.parse(time, MONTH_FORMATTER).atEndOfMonth();
    }

    public record EcosObservationPayload(LocalDate baseDate, BigDecimal value) {
    }

    public record EcosStatisticSearchResponse(
        @JsonProperty("StatisticSearch")
        EcosStatisticSearch statisticSearch
    ) {
    }

    public record EcosStatisticSearch(List<EcosObservation> row) {
    }

    public record EcosObservation(
        @JsonProperty("TIME")
        String time,
        @JsonProperty("DATA_VALUE")
        String dataValue
    ) {
    }
}
