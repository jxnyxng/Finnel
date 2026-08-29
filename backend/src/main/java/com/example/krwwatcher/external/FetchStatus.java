package com.example.krwwatcher.external;

public enum FetchStatus {
    SUCCESS_EMPTY(false),
    SUCCESS_WITH_ROWS(false),
    NOT_CONFIGURED(false),
    REMOTE_ERROR(true),
    PARSE_ERROR(true),
    SCHEMA_MISMATCH(false);

    private final boolean retryable;

    FetchStatus(boolean retryable) {
        this.retryable = retryable;
    }

    public boolean retryable() {
        return retryable;
    }
}
