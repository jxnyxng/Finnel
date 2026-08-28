// Tests for domestic indicator metadata and explanatory copy.
package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class DashboardDomesticIndicatorMetadataTest {

    private final DashboardDomesticIndicatorMetadata metadata = new DashboardDomesticIndicatorMetadata();

    @Test
    void returnsBaseMetadataForCoreIndicators() {
        assertThat(metadata.baseMetadata("USD_KRW")).isEqualTo(new DomesticIndicatorMetadata("원/달러 환율", "KRW"));
        assertThat(metadata.baseMetadata("UNKNOWN")).isNull();
    }

    @Test
    void returnsPendingMetadataForKnownFutureIndicators() {
        assertThat(metadata.pendingMetadata("SOFR_INDEX")).isEqualTo(new DomesticIndicatorMetadata("SOFR 지수", "INDEX"));
        assertThatThrownBy(() -> metadata.pendingMetadata("UNKNOWN"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unsupported domestic indicator code");
    }

    @Test
    void keepsImpactAndNoteCopyForRepresentativeIndicators() {
        assertThat(metadata.impact("M2")).contains("통화량 증가");
        assertThat(metadata.note("FISCAL_BALANCE")).isEqualTo("열린재정 BudgetBalance, 월별 관리재정수지 조원 단위 저장값입니다.");
        assertThat(metadata.impact("UNKNOWN")).isEqualTo("환율에 영향을 줄 수 있는 국내 정책·거시경제 지표입니다.");
        assertThat(metadata.note("UNKNOWN")).isEqualTo("ECOS 저장값 기준입니다.");
    }
}
