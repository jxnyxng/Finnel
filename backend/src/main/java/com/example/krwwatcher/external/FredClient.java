package com.example.krwwatcher.external;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.example.krwwatcher.config.ExternalApiProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class FredClient {

    private final ExternalApiProperties properties;
    private final RestClient restClient;

    public FredClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.fred().baseUrl()).build();
    }

    public List<FredObservationPayload> fetchObservations(String seriesId, LocalDate observationStart) {
        if (!StringUtils.hasText(properties.fred().apiKey())) {
            return List.of();
        }

        FredObservationResponse response = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/series/observations")
                .queryParam("api_key", properties.fred().apiKey())
                .queryParam("file_type", "json")
                .queryParam("series_id", seriesId)
                .queryParam("observation_start", observationStart)
                .queryParam("sort_order", "asc")
                .build())
            .retrieve()
            .body(FredObservationResponse.class);

        if (response == null || response.observations() == null) {
            return List.of();
        }

        return response.observations().stream()
            .filter(item -> item.value() != null && !".".equals(item.value()))
            .map(item -> new FredObservationPayload(LocalDate.parse(item.date()), new BigDecimal(item.value())))
            .toList();
    }

    public record FredObservationPayload(LocalDate baseDate, BigDecimal value) {
    }

    public record FredObservationResponse(List<FredObservation> observations) {
    }

    public record FredObservation(String date, String value) {
    }
}
