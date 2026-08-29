package com.example.krwwatcher.external;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

class FetchResultTest {

    @Test
    void classifiesSuccessStatuses() {
        assertThat(FetchResult.success(List.of("row")).isSuccess()).isTrue();
        assertThat(FetchResult.success(List.of()).isSuccess()).isTrue();
        assertThat(FetchResult.failure(FetchStatus.REMOTE_ERROR, "remote").isSuccess()).isFalse();
    }

    @Test
    void rowsOrThrowReturnsRowsForSuccessAndEmptyRowsForNotConfigured() {
        assertThat(FetchResult.success(List.of("row")).rowsOrThrow("source")).containsExactly("row");
        assertThat(FetchResult.failure(FetchStatus.NOT_CONFIGURED, "missing").rowsOrThrow("source")).isEmpty();
    }

    @Test
    void rowsOrThrowRaisesExternalApiFetchExceptionForAbnormalFetchResult() {
        assertThatThrownBy(() -> FetchResult.failure(FetchStatus.SCHEMA_MISMATCH, "missing rows").rowsOrThrow("source"))
            .isInstanceOf(ExternalApiFetchException.class)
            .hasMessage("source SCHEMA_MISMATCH: missing rows");
    }
}
