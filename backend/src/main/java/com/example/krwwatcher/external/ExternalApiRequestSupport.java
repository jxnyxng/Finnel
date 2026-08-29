package com.example.krwwatcher.external;

import java.util.function.Function;
import java.util.function.Supplier;

import org.springframework.web.client.RestClientException;

// Wraps external HTTP request failures into structured fetch results.
class ExternalApiRequestSupport {

    <T> FetchResult<T> fetchResult(
        Supplier<String> request,
        Function<String, FetchResult<T>> parser
    ) {
        try {
            return parser.apply(request.get());
        } catch (RestClientException exception) {
            return FetchResult.failure(FetchStatus.REMOTE_ERROR, "request failed: " + exception.getClass().getSimpleName());
        }
    }
}
