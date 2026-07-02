package com.example.krwwatcher.external;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import com.example.krwwatcher.config.ExternalApiProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class BisClient {

    private static final String DAILY = "D: Daily";
    private static final String MONTHLY = "M: Monthly";
    private static final String NOMINAL = "N: Nominal";
    private static final String REAL = "R: Real";
    private static final String BROAD = "B: Broad (64 economies)";

    private final ExternalApiProperties properties;

    public BisClient(ExternalApiProperties properties) {
        this.properties = properties;
    }

    public List<EffectiveExchangeRatePayload> fetchLatestBroadEffectiveExchangeRates() {
        if (properties.bis() == null || !StringUtils.hasText(properties.bis().effectiveExchangeRatesBulkUrl())) {
            return List.of();
        }

        Map<String, EffectiveExchangeRatePayload> latestByKey = new LinkedHashMap<>();
        try (
            ZipInputStream zipInputStream = new ZipInputStream(
                URI.create(properties.bis().effectiveExchangeRatesBulkUrl()).toURL().openStream()
            )
        ) {
            ZipEntry entry = zipInputStream.getNextEntry();
            if (entry == null) {
                return List.of();
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(zipInputStream, StandardCharsets.UTF_8));
            reader.readLine();

            String line;
            while ((line = reader.readLine()) != null) {
                List<String> columns = parseCsvLine(line);
                if (columns.size() <= 8) {
                    continue;
                }

                String frequency = columns.get(3);
                String type = columns.get(4);
                String basket = columns.get(5);
                String refArea = columns.get(6);
                String timePeriod = columns.get(7);
                String value = columns.get(8);
                if (!BROAD.equals(basket) || !StringUtils.hasText(timePeriod) || !StringUtils.hasText(value) || "NaN".equals(value)) {
                    continue;
                }

                String indexType;
                LocalDate baseDate;
                if (DAILY.equals(frequency) && NOMINAL.equals(type)) {
                    indexType = "NEER";
                    baseDate = LocalDate.parse(timePeriod);
                } else if (MONTHLY.equals(frequency) && REAL.equals(type)) {
                    indexType = "REER";
                    baseDate = YearMonth.parse(timePeriod).atEndOfMonth();
                } else {
                    continue;
                }

                Area area = parseArea(refArea);
                EffectiveExchangeRatePayload payload = new EffectiveExchangeRatePayload(
                    baseDate,
                    area.code(),
                    area.name(),
                    indexType,
                    "BROAD",
                    new BigDecimal(value),
                    Instant.now()
                );
                String key = payload.indexType() + ":" + payload.areaCode();
                EffectiveExchangeRatePayload previous = latestByKey.get(key);
                if (previous == null || payload.baseDate().isAfter(previous.baseDate())) {
                    latestByKey.put(key, payload);
                }
            }
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to fetch BIS effective exchange rates", exception);
        }

        return latestByKey.values().stream()
            .sorted(Comparator
                .comparing(EffectiveExchangeRatePayload::indexType)
                .thenComparing(EffectiveExchangeRatePayload::areaCode))
            .toList();
    }

    private Area parseArea(String refArea) {
        int separator = refArea.indexOf(": ");
        if (separator < 0) {
            return new Area(refArea, refArea);
        }

        return new Area(refArea.substring(0, separator), refArea.substring(separator + 2));
    }

    private List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int index = 0; index < line.length(); index++) {
            char character = line.charAt(index);
            if (character == '"') {
                if (quoted && index + 1 < line.length() && line.charAt(index + 1) == '"') {
                    current.append('"');
                    index++;
                } else {
                    quoted = !quoted;
                }
            } else if (character == ',' && !quoted) {
                values.add(current.toString());
                current.setLength(0);
            } else {
                current.append(character);
            }
        }
        values.add(current.toString());
        return values;
    }

    private record Area(String code, String name) {
    }

    public record EffectiveExchangeRatePayload(
        LocalDate baseDate,
        String areaCode,
        String areaName,
        String indexType,
        String basketType,
        BigDecimal value,
        Instant fetchedAt
    ) {
    }
}
