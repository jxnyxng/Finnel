package com.example.krwwatcher.external;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class EcosClient {

    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyyMM");
    private static final BigDecimal THOUSAND = new BigDecimal("1000");

    private final ExternalApiProperties properties;
    private final RestClient restClient;

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

    public List<EcosObservationPayload> fetchStatisticObservations(String statCode, String cycle, YearMonth startMonth, YearMonth endMonth, String itemCode) {
        ExternalApiProperties.Ecos config = properties.ecos();
        if (!StringUtils.hasText(config.apiKey())) {
            return List.of();
        }

        return fetchRawObservations(
            statCode,
            cycle,
            startMonth.format(MONTH_FORMATTER),
            endMonth.format(MONTH_FORMATTER),
            itemCode
        ).stream()
            .map(item -> new EcosObservationPayload(
                YearMonth.parse(item.time(), MONTH_FORMATTER).atEndOfMonth(),
                new BigDecimal(item.dataValue())
            ))
            .toList();
    }

    private List<EcosObservation> fetchRawObservations(String statCode, String cycle, String start, String end, String itemCode) {
        EcosStatisticSearchResponse response = restClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/StatisticSearch/{apiKey}/json/kr/1/1000/{statCode}/{cycle}/{start}/{end}/{itemCode}")
                .build(properties.ecos().apiKey(), statCode, cycle, start, end, itemCode))
            .retrieve()
            .body(EcosStatisticSearchResponse.class);

        if (response == null || response.statisticSearch() == null || response.statisticSearch().row() == null) {
            return List.of();
        }

        return response.statisticSearch().row().stream()
            .filter(item -> StringUtils.hasText(item.time()))
            .filter(item -> StringUtils.hasText(item.dataValue()))
            .toList();
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
