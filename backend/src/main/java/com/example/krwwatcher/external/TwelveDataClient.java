package com.example.krwwatcher.external;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class TwelveDataClient {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ExternalApiProperties properties;
    private final RestClient restClient;

    public TwelveDataClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.twelveData().baseUrl()).build();
    }

    public List<IntradayExchangePayload> fetchUsdKrwIntraday() {
        ExternalApiProperties.TwelveData config = properties.twelveData();
        if (!StringUtils.hasText(config.apiKey())) {
            return List.of();
        }

        TwelveDataTimeSeriesResponse response = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/time_series")
                .queryParam("symbol", config.usdKrwSymbol())
                .queryParam("interval", config.intradayInterval())
                .queryParam("outputsize", config.intradayOutputSize())
                .queryParam("timezone", "Asia/Seoul")
                .queryParam("apikey", config.apiKey())
                .build())
            .retrieve()
            .body(TwelveDataTimeSeriesResponse.class);

        if (response == null || response.values() == null) {
            return List.of();
        }

        return response.values().stream()
            .map(value -> new IntradayExchangePayload(
                LocalDateTime.parse(value.datetime(), DATE_TIME_FORMATTER),
                config.usdKrwSymbol(),
                new BigDecimal(value.close())
            ))
            .toList();
    }

    public List<DailyExchangePayload> fetchUsdKrwDaily() {
        ExternalApiProperties.TwelveData config = properties.twelveData();
        if (!StringUtils.hasText(config.apiKey())) {
            return List.of();
        }

        TwelveDataTimeSeriesResponse response = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/time_series")
                .queryParam("symbol", config.usdKrwSymbol())
                .queryParam("interval", "1day")
                .queryParam("outputsize", config.dailyOutputSize())
                .queryParam("timezone", "Asia/Seoul")
                .queryParam("apikey", config.apiKey())
                .build())
            .retrieve()
            .body(TwelveDataTimeSeriesResponse.class);

        if (response == null || response.values() == null) {
            return List.of();
        }

        return response.values().stream()
            .map(value -> new DailyExchangePayload(
                LocalDate.parse(value.datetime().substring(0, 10)),
                config.usdKrwSymbol(),
                new BigDecimal(value.close())
            ))
            .toList();
    }

    public record IntradayExchangePayload(LocalDateTime observedAt, String currencyPair, BigDecimal closeRate) {
    }

    public record DailyExchangePayload(LocalDate baseDate, String currencyPair, BigDecimal closeRate) {
    }

    public record TwelveDataTimeSeriesResponse(
        Meta meta,
        List<TwelveDataValue> values,
        String status,
        String message,
        Integer code
    ) {
    }

    public record Meta(String symbol, String interval, String currencyBase, String currencyQuote) {
    }

    public record TwelveDataValue(
        String datetime,
        String open,
        String high,
        String low,
        String close
    ) {
    }
}
