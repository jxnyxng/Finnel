package com.example.krwwatcher.external;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
    void policyBriefingNonXmlErrorResponseIsIgnored() {
        List<PolicyBriefingClient.PolicyBriefingPayload> result = PolicyBriefingClient.parseItems(
            """
                {"response":{"header":{"resultCode":"SERVICE_ERROR"}}}
                """
        );

        assertThat(result).isEmpty();
    }

    @Test
    void policyBriefingMalformedXmlResponseIsIgnored() {
        List<PolicyBriefingClient.PolicyBriefingPayload> result = PolicyBriefingClient.parseItems(
            "<response><body><items><item><Title>broken"
        );

        assertThat(result).isEmpty();
    }

    @Test
    void policyBriefingApiErrorResponseThrows() {
        assertThatThrownBy(() -> PolicyBriefingClient.parseItems(
            """
                <?xml version="1.0" encoding="UTF-8"?>
                <response>
                  <header>
                    <resultCode>98</resultCode>
                    <resultMsg>THREE_DAYS_OVER_ERROR</resultMsg>
                  </header>
                  <body></body>
                </response>
                """
        ))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("THREE_DAYS_OVER_ERROR");
    }

    @Test
    void policyBriefingNewsItemResponseParsesKoreanContentAndUsDate() {
        List<PolicyBriefingClient.PolicyBriefingPayload> result = PolicyBriefingClient.parseItems(
            """
                <?xml version="1.0" encoding="UTF-8"?>
                <response>
                  <header>
                    <resultCode>0</resultCode>
                    <resultMsg>NORMAL_SERVICE</resultMsg>
                  </header>
                  <body>
                    <NewsItem>
                      <ModifyDate>08/05/2026 08:49:29</ModifyDate>
                      <ApproveDate>08/04/2026 20:49:00</ApproveDate>
                      <GroupingCode>visual</GroupingCode>
                      <Title><![CDATA["중소기업부터 골목상권까지 성장의 온기가 전달되도록"]]></Title>
                      <SubTitle1><![CDATA[이재명 대통령 주재 국민과 함께하는 두 번째 업무보고(2026.8.4.)]]></SubTitle1>
                      <DataContents><![CDATA[
                        <p>정부는 중소기업과 소상공인 지원, 공정거래 질서 확립, 수출 회복과 물가 안정을 위한 정책 대응을 이어간다.</p>
                      ]]></DataContents>
                      <MinisterCode>문화체육관광부</MinisterCode>
                      <OriginalUrl><![CDATA[https://www.korea.kr/multi/visualNewsView.do?newsId=148969392&call_from=openData]]></OriginalUrl>
                      <KoglType><![CDATA[4]]></KoglType>
                    </NewsItem>
                  </body>
                </response>
                """
        );

        assertThat(result).hasSize(1);
        PolicyBriefingClient.PolicyBriefingPayload payload = result.get(0);
        assertThat(payload.title()).isEqualTo("\"중소기업부터 골목상권까지 성장의 온기가 전달되도록\"");
        assertThat(payload.body()).contains("중소기업과 소상공인 지원");
        assertThat(payload.category()).isEqualTo("visual");
        assertThat(payload.publishedAt()).isNotNull();
    }

    @Test
    void policyBriefingNewsItemResponseFallsBackWhenWholeXmlIsMalformed() {
        List<PolicyBriefingClient.PolicyBriefingPayload> result = PolicyBriefingClient.parseItems(
            """
                <?xml version="1.0" encoding="UTF-8"?>
                <response>
                  <body>
                    <NewsItem>
                      <ApproveDate>08/04/2026 20:49:00</ApproveDate>
                      <GroupingCode>visual</GroupingCode>
                      <Title><![CDATA[공정거래위원회가 하반기 민생분야 불공정행위를 근절한다]]></Title>
                      <DataContents><![CDATA[
                        <p>정부는 중소기업과 소상공인 지원, 공정거래 질서 확립, 민생 안정 대책을 추진한다.</p>
                      ]]></DataContents>
                      <MinisterCode>공정거래위원회</MinisterCode>
                      <OriginalUrl>https://www.korea.kr/news/policyNewsView.do?newsId=148969391&call_from=openData</OriginalUrl>
                    </NewsItem>
                  </body>
                </response>
                """
        );

        assertThat(result).hasSize(1);
        PolicyBriefingClient.PolicyBriefingPayload payload = result.get(0);
        assertThat(payload.title()).contains("공정거래위원회");
        assertThat(payload.body()).contains("소상공인 지원");
        assertThat(payload.originalUrl()).contains("newsId=148969391");
    }

    @Test
    void policyBriefingJsonNewsItemResponseParses() {
        List<PolicyBriefingClient.PolicyBriefingPayload> result = PolicyBriefingClient.parseItems(
            """
                {
                  "header": {
                    "resultCode": "0",
                    "resultMsg": "NORMAL_SERVICE"
                  },
                  "body": {
                    "NewsItem": [
                      {
                        "NewsItemId": "148969565",
                        "ModifyDate": "08/06/2026 16:14:23",
                        "ApproveDate": "08/06/2026 16:14:00",
                        "GroupingCode": "policy",
                        "Title": "포항 AI센터·영광 에너지저장장치, 지역활성화 투자 펀드 선정",
                        "SubTitle1": "포항에 6000억 투입 AI 전용 데이터센터 건설",
                        "DataContents": "<p>기획예산처는 지역활성화 투자 펀드 프로젝트를 선정하고 산업 기반 확충을 지원한다.</p>",
                        "MinisterCode": "기획예산처",
                        "OriginalUrl": "https://www.korea.kr/news/policyNewsView.do?newsId=148969565",
                        "KoglType": "1"
                      }
                    ]
                  }
                }
                """
        );

        assertThat(result).hasSize(1);
        PolicyBriefingClient.PolicyBriefingPayload payload = result.get(0);
        assertThat(payload.title()).contains("포항 AI센터");
        assertThat(payload.category()).isEqualTo("policy");
        assertThat(payload.body()).contains("지역활성화 투자 펀드");
        assertThat(payload.publishedAt()).isNotNull();
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
