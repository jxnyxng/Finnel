package com.example.krwwatcher.external;

public class ExternalApiFetchException extends RuntimeException {

    private final String sourceName;
    private final FetchStatus fetchStatus;

    public ExternalApiFetchException(String message) {
        super(message);
        this.sourceName = null;
        this.fetchStatus = null;
    }

    public ExternalApiFetchException(String sourceName, FetchStatus fetchStatus, String message) {
        super(sourceName + " " + fetchStatus + ": " + message);
        this.sourceName = sourceName;
        this.fetchStatus = fetchStatus;
    }

    public String sourceName() {
        return sourceName;
    }

    public FetchStatus fetchStatus() {
        return fetchStatus;
    }

    public boolean retryable() {
        return fetchStatus != null && fetchStatus.retryable();
    }
}
