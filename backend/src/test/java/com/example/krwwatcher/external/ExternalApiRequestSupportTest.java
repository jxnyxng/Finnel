package com.example.krwwatcher.external;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;

class ExternalApiRequestSupportTest {

    private final ExternalApiRequestSupport support = new ExternalApiRequestSupport();

    @Test
    void returnsParsedFetchResultWhenRequestSucceeds() {
        FetchResult<String> result = support.fetchResult(
            () -> "{\"rows\":[]}",
            response -> FetchResult.success(List.of(response))
        );

        assertThat(result.status()).isEqualTo(FetchStatus.SUCCESS_WITH_ROWS);
        assertThat(result.rows()).containsExactly("{\"rows\":[]}");
    }

    @Test
    void wrapsRestClientFailureAsRemoteError() {
        FetchResult<String> result = support.fetchResult(
            () -> {
                throw new ResourceAccessException("timeout");
            },
            response -> FetchResult.success(List.of(response))
        );

        assertThat(result.status()).isEqualTo(FetchStatus.REMOTE_ERROR);
        assertThat(result.message()).isEqualTo("request failed: ResourceAccessException");
        assertThat(result.rows()).isEmpty();
    }

    @Test
    void letsParserResultClassifyMalformedResponse() {
        FetchResult<String> result = support.fetchResult(
            () -> "<html>Bad Gateway</html>",
            response -> FetchResult.failure(FetchStatus.PARSE_ERROR, "non-json")
        );

        assertThat(result.status()).isEqualTo(FetchStatus.PARSE_ERROR);
        assertThat(result.message()).isEqualTo("non-json");
    }

    @Test
    void doesNotHideUnexpectedParserFailures() {
        assertThatThrownBy(() -> support.fetchResult(
            () -> "body",
            response -> {
                throw new IllegalArgumentException("bad parser");
            }
        ))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("bad parser");
    }
}
