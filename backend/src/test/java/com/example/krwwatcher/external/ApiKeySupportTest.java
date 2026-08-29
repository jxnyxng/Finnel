package com.example.krwwatcher.external;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ApiKeySupportTest {

    private final ApiKeySupport support = new ApiKeySupport();

    @Test
    void rejectsBlankAndPlaceholderApiKeys() {
        assertThat(support.hasUsableApiKey(null)).isFalse();
        assertThat(support.hasUsableApiKey("")).isFalse();
        assertThat(support.hasUsableApiKey("   ")).isFalse();
        assertThat(support.hasUsableApiKey("replace-me")).isFalse();
        assertThat(support.hasUsableApiKey(" REPLACE-ME ")).isFalse();
    }

    @Test
    void acceptsNonPlaceholderApiKey() {
        assertThat(support.hasUsableApiKey("real-api-key")).isTrue();
    }
}
