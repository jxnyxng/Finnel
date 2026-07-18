package com.example.krwwatcher;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.example.krwwatcher.config.SyncProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties({ExternalApiProperties.class, SyncProperties.class})
public class KrwWatcherApplication {

    public static void main(String[] args) {
        SpringApplication.run(KrwWatcherApplication.class, args);
    }
}
