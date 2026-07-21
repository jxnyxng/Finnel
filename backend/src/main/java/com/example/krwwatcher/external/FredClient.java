package com.example.krwwatcher.external;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class FredClient {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final ExternalApiProperties properties;
    private final RestClient restClient;

    public FredClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.fred().baseUrl()).build();
    }

    public List<FredObservationPayload> fetchObservations(String seriesId, LocalDate observationStart) {
        return fetchObservationsResult(seriesId, observationStart).rowsOrThrow("FRED " + seriesId);
    }

    FetchResult<FredObservationPayload> fetchObservationsResult(String seriesId, LocalDate observationStart) {
        if (!StringUtils.hasText(properties.fred().apiKey())) {
            return FetchResult.failure(FetchStatus.NOT_CONFIGURED, "FRED API key is not configured");
        }

        String response = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/series/observations")
                .queryParam("api_key", properties.fred().apiKey())
                .queryParam("file_type", "json")
                .queryParam("series_id", seriesId)
                .queryParam("observation_start", observationStart)
                .queryParam("sort_order", "asc")
                .build())
            .retrieve()
            .body(String.class);

        return parseObservations(response);
    }

    static FetchResult<FredObservationPayload> parseObservations(String response) {
        if (!StringUtils.hasText(response)) {
            return FetchResult.failure(FetchStatus.PARSE_ERROR, "FRED response body is empty");
        }
        if (response.trim().startsWith("<")) {
            return FetchResult.failure(FetchStatus.PARSE_ERROR, "FRED returned non-JSON response");
        }

        try {
            JsonNode root = OBJECT_MAPPER.readTree(response);
            if (root.has("error_code")) {
                return FetchResult.failure(FetchStatus.REMOTE_ERROR, root.path("error_message").asText("FRED remote error"));
            }

            JsonNode observations = root.path("observations");
            if (observations.isMissingNode() || observations.isNull() || !observations.isArray()) {
                return FetchResult.failure(FetchStatus.SCHEMA_MISMATCH, "FRED response is missing observations array");
            }
            if (observations.isEmpty()) {
                return FetchResult.success(List.of());
            }

            List<FredObservationPayload> rows = new ArrayList<>();
            for (JsonNode item : observations) {
                String date = item.path("date").asText(null);
                String value = item.path("value").asText(null);
                if (!StringUtils.hasText(date) || value == null) {
                    return FetchResult.failure(FetchStatus.SCHEMA_MISMATCH, "FRED observation is missing date or value");
                }
                if (".".equals(value)) {
                    continue;
                }
                rows.add(new FredObservationPayload(LocalDate.parse(date), new BigDecimal(value)));
            }

            return FetchResult.success(rows);
        } catch (RuntimeException | java.io.IOException exception) {
            return FetchResult.failure(FetchStatus.PARSE_ERROR, exception.getMessage());
        }
    }

    public record FredObservationPayload(LocalDate baseDate, BigDecimal value) {
    }

    public record FredObservationResponse(List<FredObservation> observations) {
    }

    public record FredObservation(String date, String value) {
    }
}
