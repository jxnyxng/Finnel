package com.example.krwwatcher.external;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class ExternalClientContractTest {

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
