package com.example.krwwatcher.external;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.example.krwwatcher.config.ExternalApiProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class KoreaeximExchangeClient {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.BASIC_ISO_DATE;
    private final ExternalApiProperties properties;
    private final RestClient restClient;

    public KoreaeximExchangeClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.koreaexim().baseUrl()).build();
    }

    public Optional<ExchangeRatePayload> fetchLatestUsdKrw(LocalDate baseDate) {
        if (!StringUtils.hasText(properties.koreaexim().apiKey())) {
            return Optional.empty();
        }

        for (int daysBack = 0; daysBack < 14; daysBack++) {
            LocalDate searchDate = baseDate.minusDays(daysBack);
            KoreaeximExchangeResponse[] response = fetchExchangeRates(searchDate);

            Optional<ExchangeRatePayload> usd = findUsd(response, searchDate);
            if (usd.isPresent()) {
                return usd;
            }
        }

        return Optional.empty();
    }

    public List<ExchangeRatePayload> fetchLatestExchangeRates(LocalDate baseDate, Set<String> currencyPrefixes) {
        if (!StringUtils.hasText(properties.koreaexim().apiKey())) {
            return List.of();
        }

        for (int daysBack = 0; daysBack < 14; daysBack++) {
            LocalDate searchDate = baseDate.minusDays(daysBack);
            KoreaeximExchangeResponse[] response = fetchExchangeRates(searchDate);
            List<ExchangeRatePayload> payloads = findCurrencies(response, searchDate, currencyPrefixes);
            if (!payloads.isEmpty()) {
                return payloads;
            }
        }

        return List.of();
    }

    public List<ExchangeRatePayload> fetchExchangeRates(LocalDate baseDate, Set<String> currencyPrefixes) {
        if (!StringUtils.hasText(properties.koreaexim().apiKey())) {
            return List.of();
        }

        return findCurrencies(fetchExchangeRates(baseDate), baseDate, currencyPrefixes);
    }

    private KoreaeximExchangeResponse[] fetchExchangeRates(LocalDate searchDate) {
        return restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/exchangeJSON")
                .queryParam("authkey", properties.koreaexim().apiKey())
                .queryParam("searchdate", searchDate.format(DATE_FORMATTER))
                .queryParam("data", "AP01")
                .build())
            .retrieve()
            .body(KoreaeximExchangeResponse[].class);
    }

    private Optional<ExchangeRatePayload> findUsd(KoreaeximExchangeResponse[] response, LocalDate baseDate) {
        if (response == null || response.length == 0) {
            return Optional.empty();
        }

        return Arrays.stream(response)
            .filter(item -> item.curUnit() != null && item.curUnit().startsWith("USD"))
            .findFirst()
            .map(item -> new ExchangeRatePayload(
                baseDate,
                "USD",
                item.curNm(),
                parseDecimal(item.dealBasR())
            ));
    }

    private List<ExchangeRatePayload> findCurrencies(KoreaeximExchangeResponse[] response, LocalDate baseDate, Set<String> currencyPrefixes) {
        if (response == null || response.length == 0 || currencyPrefixes.isEmpty()) {
            return List.of();
        }

        return Arrays.stream(response)
            .filter(item -> StringUtils.hasText(item.curUnit()) && StringUtils.hasText(item.dealBasR()))
            .filter(item -> currencyPrefixes.stream().anyMatch(prefix -> item.curUnit().startsWith(prefix)))
            .map(item -> new ExchangeRatePayload(
                baseDate,
                item.curUnit(),
                item.curNm(),
                parseDecimal(item.dealBasR())
            ))
            .toList();
    }

    private BigDecimal parseDecimal(String value) {
        return new BigDecimal(value.replace(",", ""));
    }

    public record ExchangeRatePayload(LocalDate baseDate, String currencyCode, String currencyName, BigDecimal dealBasRate) {
    }

    public record KoreaeximExchangeResponse(
        String result,
        @JsonProperty("cur_unit")
        String curUnit,
        String ttb,
        String tts,
        @JsonProperty("deal_bas_r")
        String dealBasR,
        String bkpr,
        @JsonProperty("yy_efee_r")
        String yyEfeeR,
        @JsonProperty("ten_dd_efee_r")
        String tenDdEfeeR,
        @JsonProperty("kftc_bkpr")
        String kftcBkpr,
        @JsonProperty("kftc_deal_bas_r")
        String kftcDealBasR,
        @JsonProperty("cur_nm")
        String curNm
    ) {
    }
}
