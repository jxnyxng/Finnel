package com.example.krwwatcher.external;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import com.example.krwwatcher.config.ExternalApiProperties;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class ExternalClientContractTest {

    @Test
    void twelveDataClientWaitsForNextMinuteWindowBeforeNinthRequest() {
        AtomicLong now = new AtomicLong(1_000L);
        AtomicLong sleptMillis = new AtomicLong(0L);
        TwelveDataClient client = new TwelveDataClient(
            twelveDataProperties(),
            RestClient.builder(),
            now::get,
            millis -> {
                sleptMillis.addAndGet(millis);
                now.addAndGet(millis);
            }
        );

        for (int i = 0; i < 8; i++) {
            client.reserveRequestSlot();
        }

        client.reserveRequestSlot();

        assertThat(sleptMillis).hasValue(60_000L);
    }

    @Test
    void policyBriefingV2ResponseWithoutRemovedImageFieldsParses() {
        List<PolicyBriefingClient.PolicyBriefingPayload> result = PolicyBriefingClient.parseItems(
            """
                <response>
                  <body>
                    <items>
                      <item>
                        <Title>환율 안정 정책 발표</Title>
                        <SubTitle1>시장 변동성 점검</SubTitle1>
                        <DataContents>정부는 외환시장 변동성을 점검하고 금융시장 안정을 위한 정책 대응을 이어간다.</DataContents>
                        <MinisterName>기획재정부</MinisterName>
                        <GroupingCode>정책뉴스</GroupingCode>
                        <ApproveDate>2026-07-23</ApproveDate>
                        <OriginalUrl>https://www.korea.kr/news/policyNewsView.do?newsId=1</OriginalUrl>
                        <KoglType>1</KoglType>
                      </item>
                    </items>
                  </body>
                </response>
                """
        );

        assertThat(result).hasSize(1);
        PolicyBriefingClient.PolicyBriefingPayload payload = result.get(0);
        assertThat(payload.title()).isEqualTo("환율 안정 정책 발표");
        assertThat(payload.thumbnailUrl()).isNull();
        assertThat(payload.imageUrl()).isNull();
        assertThat(payload.koglType()).isEqualTo("1");
    }

    @Test
    void openFiscalHtmlErrorIsParseError() {
        FetchResult<OpenFiscalClient.OpenFiscalObservationPayload> result = OpenFiscalClient.parseObservations(
            "<html><body>Bad Gateway</body></html>",
            List.of("FISCAL_BALANCE")
        );

        assertThat(result.status()).isEqualTo(FetchStatus.PARSE_ERROR);
    }

    @Test
    void openFiscalEmptyJsonIsSchemaMismatch() {
        FetchResult<OpenFiscalClient.OpenFiscalObservationPayload> result = OpenFiscalClient.parseObservations(
            "{}",
            List.of("FISCAL_BALANCE")
        );

        assertThat(result.status()).isEqualTo(FetchStatus.SCHEMA_MISMATCH);
    }

    @Test
    void openFiscalRenamedRequiredFieldsAreSchemaMismatch() {
        FetchResult<OpenFiscalClient.OpenFiscalObservationPayload> result = OpenFiscalClient.parseObservations(
            """
                {
                  "BudgetBalance": [
                    { "BASE_MONTH": "202607", "RENAMED_BALANCE_VALUE": "12.34" }
                  ]
                }
                """,
            List.of("FISCAL_BALANCE")
        );

        assertThat(result.status()).isEqualTo(FetchStatus.SCHEMA_MISMATCH);
    }

    @Test
    void fredHtmlErrorIsParseError() {
        FetchResult<FredClient.FredObservationPayload> result = FredClient.parseObservations(
            "<html><body>service unavailable</body></html>"
        );

        assertThat(result.status()).isEqualTo(FetchStatus.PARSE_ERROR);
    }

    @Test
    void fredEmptyJsonIsSchemaMismatch() {
        FetchResult<FredClient.FredObservationPayload> result = FredClient.parseObservations("{}");

        assertThat(result.status()).isEqualTo(FetchStatus.SCHEMA_MISMATCH);
    }

    @Test
    void fredRenamedRequiredFieldsAreSchemaMismatch() {
        FetchResult<FredClient.FredObservationPayload> result = FredClient.parseObservations(
            """
                {
                  "observations": [
                    { "base_date": "2026-07-21", "obs_value": "1380.25" }
                  ]
                }
                """
        );

        assertThat(result.status()).isEqualTo(FetchStatus.SCHEMA_MISMATCH);
    }

    @Test
    void fredEmptyObservationArrayIsSuccessEmpty() {
        FetchResult<FredClient.FredObservationPayload> result = FredClient.parseObservations("{\"observations\":[]}");

        assertThat(result.status()).isEqualTo(FetchStatus.SUCCESS_EMPTY);
    }

    private ExternalApiProperties twelveDataProperties() {
        return new ExternalApiProperties(
            null,
            null,
            null,
            new ExternalApiProperties.TwelveData("https://api.twelvedata.com", "test-key", "USD/KRW", "1min", 5000),
            null,
            null,
            null,
            null,
            null,
            null
        );
    }

    @Test
    void ecosHtmlErrorIsParseError() {
        FetchResult<EcosClient.EcosObservation> result = EcosClient.parseRawObservations(
            "<html><body>bad gateway</body></html>"
        );

        assertThat(result.status()).isEqualTo(FetchStatus.PARSE_ERROR);
    }

    @Test
    void ecosEmptyJsonIsSchemaMismatch() {
        FetchResult<EcosClient.EcosObservation> result = EcosClient.parseRawObservations("{}");

        assertThat(result.status()).isEqualTo(FetchStatus.SCHEMA_MISMATCH);
    }

    @Test
    void ecosRenamedRequiredFieldsAreSchemaMismatch() {
        FetchResult<EcosClient.EcosObservation> result = EcosClient.parseRawObservations(
            """
                {
                  "StatisticSearch": {
                    "row": [
                      { "BASE_TIME": "202607", "VALUE": "123.45" }
                    ]
                  }
                }
                """
        );

        assertThat(result.status()).isEqualTo(FetchStatus.SCHEMA_MISMATCH);
    }

    @Test
    void ecosNoPublishedDataResultIsSuccessEmpty() {
        FetchResult<EcosClient.EcosObservation> result = EcosClient.parseRawObservations(
            """
                {
                  "RESULT": {
                    "CODE": "INFO-200",
                    "MESSAGE": "해당하는 데이터가 없습니다"
                  }
                }
                """
        );

        assertThat(result.status()).isEqualTo(FetchStatus.SUCCESS_EMPTY);
    }
}
