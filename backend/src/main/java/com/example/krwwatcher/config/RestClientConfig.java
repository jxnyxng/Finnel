package com.example.krwwatcher.config;

import java.time.Duration;

import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    RestClient.Builder restClientBuilder() {
        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
            .withConnectTimeout(Duration.ofSeconds(5))
            .withReadTimeout(Duration.ofSeconds(10));

        return RestClient.builder()
            .requestFactory(ClientHttpRequestFactories.get(settings))
            .defaultHeader("User-Agent", "KRW-Watcher/0.1")
            .defaultHeader("Accept", "application/json,text/plain,*/*");
    }
}
