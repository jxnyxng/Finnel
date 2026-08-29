package com.example.krwwatcher.external;

import org.springframework.util.StringUtils;

// Provides common external API credential validation helpers.
class ApiKeySupport {

    private static final String PLACEHOLDER_API_KEY = "replace-me";

    boolean hasUsableApiKey(String apiKey) {
        return StringUtils.hasText(apiKey)
            && !PLACEHOLDER_API_KEY.equalsIgnoreCase(apiKey.trim());
    }
}
