// Tests for dashboard source label and URL mapping.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DashboardSourceMapperTest {

    private final DashboardSourceMapper mapper = new DashboardSourceMapper();

    @Test
    void splitsSourceLabelAndDetailUrl() {
        assertThat(mapper.label("ECOS:722Y001|https://ecos.bok.or.kr/detail")).isEqualTo("ECOS:722Y001");
        assertThat(mapper.detailUrl("ECOS:722Y001|https://ecos.bok.or.kr/detail")).isEqualTo("https://ecos.bok.or.kr/detail");
    }

    @Test
    void returnsExplicitDetailUrlBeforeSourceFallback() {
        assertThat(mapper.url("FRED:DGS10", "https://example.com/detail")).isEqualTo("https://example.com/detail");
    }

    @Test
    void mapsKnownSourcePrefixesToPublicUrls() {
        assertThat(mapper.url("Twelve Data:USD/KRW 1min", null)).isEqualTo("https://twelvedata.com/currencies/usd-krw");
        assertThat(mapper.url("FRED/ECOS", null)).isEqualTo("https://fred.stlouisfed.org/");
        assertThat(mapper.url("ECOS:722Y001", null)).isEqualTo("https://ecos.bok.or.kr/");
        assertThat(mapper.url("Koreaexim/FRED", null)).isEqualTo("https://www.koreaexim.go.kr/");
        assertThat(mapper.url("OPENFISCAL:BudgetBalance", null)).isEqualTo("https://www.openfiscaldata.go.kr/");
        assertThat(mapper.url("BIS:EER", null)).isEqualTo("https://data.bis.org/");
    }

    @Test
    void returnsNullForUnknownOrMissingSources() {
        assertThat(mapper.label(null)).isNull();
        assertThat(mapper.detailUrl("ECOS:722Y001")).isNull();
        assertThat(mapper.url(null, null)).isNull();
        assertThat(mapper.url("UNKNOWN", null)).isNull();
    }
}
