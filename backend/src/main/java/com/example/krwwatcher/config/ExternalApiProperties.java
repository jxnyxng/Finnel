package com.example.krwwatcher.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.external-apis")
public record ExternalApiProperties(
    Koreaexim koreaexim,
    Ecos ecos,
    Fred fred,
    TwelveData twelveData,
    Bis bis,
    Naver naver,
    OpenFiscal openFiscal,
    PolicyBriefing policyBriefing,
    Bok bok
) {

    public record Koreaexim(String baseUrl, String apiKey) {
    }

    public record Ecos(
        String baseUrl,
        String apiKey,
        String koreanPolicyRateStatCode,
        String koreanPolicyRateItemCode,
        String foreignReservesStatCode,
        String foreignReservesItemCode
    ) {
    }

    public record Fred(
        String baseUrl,
        String apiKey,
        String dollarIndexSeriesId,
        String advancedDollarIndexSeriesId,
        String usPolicyRateSeriesId,
        String usdKrwSeriesId,
        String usTenYearTreasurySeriesId,
        String vixSeriesId,
        String wtiOilSeriesId,
        String creditSpreadProxySeriesId
    ) {
    }

    public record TwelveData(
        String baseUrl,
        String apiKey,
        String usdKrwSymbol,
        String intradayInterval,
        Integer intradayOutputSize
    ) {
    }

    public record Bis(String effectiveExchangeRatesBulkUrl) {
    }

    public record Naver(
        String baseUrl,
        String clientId,
        String clientSecret
    ) {
    }

    public record OpenFiscal(
        String baseUrl,
        String apiKey
    ) {
    }

    public record PolicyBriefing(
        String baseUrl,
        String apiKey
    ) {
    }

    public record Bok(
        String baseUrl,
        String mpcMinutesPath
    ) {
    }
}
