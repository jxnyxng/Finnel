package com.example.krwwatcher.external;

import java.time.LocalDate;
import java.util.Optional;

import com.example.krwwatcher.config.ExternalApiProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class BokPortalClient {

    private final ExternalApiProperties properties;
    private final RestClient restClient;

    public BokPortalClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.bok().baseUrl()).build();
    }

    public Optional<BokDocumentPayload> fetchLatestMpcMinutesSignal() {
        String body = restClient.get()
            .uri(properties.bok().mpcMinutesPath())
            .retrieve()
            .body(String.class);

        if (!StringUtils.hasText(body) || !body.contains("한국은행")) {
            return Optional.empty();
        }

        return Optional.of(new BokDocumentPayload(
            LocalDate.now(),
            "금융통화위원회 의사록 공식 목록 확인"
        ));
    }

    public record BokDocumentPayload(LocalDate baseDate, String title) {
    }
}
