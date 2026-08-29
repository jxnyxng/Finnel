package com.example.krwwatcher.external;

import java.util.List;

public record FetchResult<T>(
    FetchStatus status,
    List<T> rows,
    String message
) {

    public static <T> FetchResult<T> success(List<T> rows) {
        List<T> safeRows = rows == null ? List.of() : rows;
        return new FetchResult<>(
            safeRows.isEmpty() ? FetchStatus.SUCCESS_EMPTY : FetchStatus.SUCCESS_WITH_ROWS,
            safeRows,
            null
        );
    }

    public static <T> FetchResult<T> failure(FetchStatus status, String message) {
        return new FetchResult<>(status, List.of(), message);
    }

    public boolean isSuccess() {
        return status == FetchStatus.SUCCESS_EMPTY || status == FetchStatus.SUCCESS_WITH_ROWS;
    }

    public List<T> rowsOrThrow(String sourceName) {
        if (isSuccess()) {
            return rows;
        }
        if (status == FetchStatus.NOT_CONFIGURED) {
            return List.of();
        }

        throw new ExternalApiFetchException(sourceName, status, message);
    }
}
