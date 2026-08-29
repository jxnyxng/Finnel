// Tests for dashboard data-source descriptions.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DashboardDataSourceInfoProviderTest {

    private final DashboardDataSourceInfoProvider provider = new DashboardDataSourceInfoProvider();

    @Test
    void keepsDataSourcesInDashboardResponseOrder() {
        assertThat(provider.dataSourceInfos())
            .extracting(DashboardService.DataSourceInfo::code)
            .containsExactly(
                "USD_KRW",
                "ADVANCED_DOLLAR_INDEX",
                "BROAD_DOLLAR_INDEX",
                "CURRENCY_STRENGTH",
                "FOREIGN_EXCHANGE",
                "MACRO",
                "FISCAL_POLICY",
                "CAPITAL_FLOW"
            );
    }

    @Test
    void keepsUsdKrwFallbackDescription() {
        DashboardService.DataSourceInfo usdKrw = provider.dataSourceInfos().get(0);

        assertThat(usdKrw.api()).contains("FRED DEXKOUS fallback");
        assertThat(usdKrw.note()).contains("Twelve Data");
        assertThat(usdKrw.note()).contains("Koreaexim/FRED");
    }
}
