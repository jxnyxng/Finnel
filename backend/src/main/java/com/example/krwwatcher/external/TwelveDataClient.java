package com.example.krwwatcher.external;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Optional;
import java.util.function.LongSupplier;

import com.example.krwwatcher.config.ExternalApiProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class TwelveDataClient {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int REQUESTS_PER_MINUTE_LIMIT = 8;
    private static final long REQUEST_WINDOW_MILLIS = 60_000L;

    private final ExternalApiProperties properties;
    private final RestClient restClient;
    private final LongSupplier clockMillis;
    private final RequestSleeper requestSleeper;
    private final Deque<Long> requestTimestamps = new ArrayDeque<>();

    @Autowired
    public TwelveDataClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.twelveData().baseUrl()).build();
        this.clockMillis = System::currentTimeMillis;
        this.requestSleeper = Thread::sleep;
    }

    TwelveDataClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder, LongSupplier clockMillis, RequestSleeper requestSleeper) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.twelveData().baseUrl()).build();
        this.clockMillis = clockMillis;
        this.requestSleeper = requestSleeper;
    }

    public List<IntradayExchangePayload> fetchUsdKrwIntraday() {
        ExternalApiProperties.TwelveData config = properties.twelveData();
        if (!StringUtils.hasText(config.apiKey())) {
            return List.of();
        }

        reserveRequestSlot();
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

        if (response == null) {
            return List.of();
        }

        if ("error".equalsIgnoreCase(response.status())) {
            throw new IllegalStateException("Twelve Data error: " + response.message());
        }

        if (response.values() == null) {
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

    public List<IntradayExchangePayload> fetchUsdKrwIntradayBetween(LocalDateTime startInclusive, LocalDateTime endInclusive) {
        ExternalApiProperties.TwelveData config = properties.twelveData();
        if (!StringUtils.hasText(config.apiKey())) {
            return List.of();
        }

        reserveRequestSlot();
        TwelveDataTimeSeriesResponse response = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/time_series")
                .queryParam("symbol", config.usdKrwSymbol())
                .queryParam("interval", config.intradayInterval())
                .queryParam("outputsize", config.intradayOutputSize())
                .queryParam("timezone", "Asia/Seoul")
                .queryParam("start_date", startInclusive.format(DATE_TIME_FORMATTER))
                .queryParam("end_date", endInclusive.format(DATE_TIME_FORMATTER))
                .queryParam("order", "ASC")
                .queryParam("apikey", config.apiKey())
                .build())
            .retrieve()
            .body(TwelveDataTimeSeriesResponse.class);

        if (response == null) {
            return List.of();
        }

        if ("error".equalsIgnoreCase(response.status())) {
            throw new IllegalStateException("Twelve Data error: " + response.message());
        }

        if (response.values() == null) {
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

    public Optional<CurrentExchangeRatePayload> fetchCurrentExchangeRate(String symbol) {
        ExternalApiProperties.TwelveData config = properties.twelveData();
        if (!StringUtils.hasText(config.apiKey())) {
            return Optional.empty();
        }

        reserveRequestSlot();
        TwelveDataExchangeRateResponse response = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/exchange_rate")
                .queryParam("symbol", symbol)
                .queryParam("apikey", config.apiKey())
                .build())
            .retrieve()
            .body(TwelveDataExchangeRateResponse.class);

        if (response == null) {
            return Optional.empty();
        }

        if ("error".equalsIgnoreCase(response.status())) {
            throw new IllegalStateException("Twelve Data error: " + response.message());
        }

        if (response.rate() == null || response.timestamp() == null) {
            return Optional.empty();
        }

        return Optional.of(new CurrentExchangeRatePayload(
            response.symbol(),
            response.rate(),
            Instant.ofEpochSecond(response.timestamp())
        ));
    }

    void reserveRequestSlot() {
        try {
            reserveRequestSlotOrWait();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for Twelve Data minute request limit", exception);
        }
    }

    private synchronized void reserveRequestSlotOrWait() throws InterruptedException {
        while (true) {
            long now = clockMillis.getAsLong();
            removeExpiredRequestTimestamps(now);
            if (requestTimestamps.size() < REQUESTS_PER_MINUTE_LIMIT) {
                requestTimestamps.addLast(now);
                return;
            }

            long waitMillis = Math.max(1L, REQUEST_WINDOW_MILLIS - (now - requestTimestamps.peekFirst()));
            requestSleeper.sleep(waitMillis);
        }
    }

    private void removeExpiredRequestTimestamps(long now) {
        while (!requestTimestamps.isEmpty() && now - requestTimestamps.peekFirst() >= REQUEST_WINDOW_MILLIS) {
            requestTimestamps.removeFirst();
        }
    }

    public record IntradayExchangePayload(LocalDateTime observedAt, String currencyPair, BigDecimal closeRate) {
    }

    @FunctionalInterface
    interface RequestSleeper {
        void sleep(long millis) throws InterruptedException;
    }

    public record CurrentExchangeRatePayload(String symbol, BigDecimal rate, Instant observedAt) {
    }

    public record TwelveDataExchangeRateResponse(
        String symbol,
        BigDecimal rate,
        Long timestamp,
        String status,
        String message,
        Integer code
    ) {
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
