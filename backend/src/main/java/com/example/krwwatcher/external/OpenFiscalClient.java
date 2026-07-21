package com.example.krwwatcher.external;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

import com.example.krwwatcher.config.ExternalApiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class OpenFiscalClient {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final List<String> DATE_KEYS = List.of("BASE_DATE", "CRTR_YM", "OJ_YM", "FSCL_YM", "YYMM");
    private static final List<String> YEAR_KEYS = List.of("OJ_YY", "FSCL_YY", "YY", "YEAR");
    private static final List<String> MONTH_KEYS = List.of("OJ_M", "FSCL_MM", "MM", "MONTH");
    private static final List<String> BUDGET_BALANCE_VALUE_KEYS = List.of(
        "MG_PFIN_RAD_AMT",
        "ITG_PFIN_RAD_AMT",
        "MNG_FISCL_BLNC_AMT",
        "MNG_FISCAL_BALANCE",
        "FISCL_BLNC_AMT",
        "FISCAL_BALANCE",
        "BUDGET_BALANCE",
        "BALANCE_AMT"
    );
    private static final List<String> GOVERNMENT_DEBT_VALUE_KEYS = List.of(
        "GOD_SUM_AMT",
        "NAT_DEBT_AMT",
        "GOVERNMENT_DEBT",
        "DEBT_AMT",
        "CENTRAL_GOVERNMENT_DEBT",
        "AMT"
    );

    private final ExternalApiProperties properties;
    private final RestClient restClient;

    public OpenFiscalClient(ExternalApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.openFiscal().baseUrl()).build();
    }

    public List<OpenFiscalObservationPayload> fetchBudgetBalances(int startYear, int endYear) {
        return fetchBudgetBalancesResult(startYear, endYear).rowsOrThrow("OpenFiscal BudgetBalance");
    }

    public List<OpenFiscalObservationPayload> fetchGovernmentDebtMonths(int startYear, int endYear) {
        return fetchGovernmentDebtMonthsResult(startYear, endYear).rowsOrThrow("OpenFiscal GovernmentDebtMonth");
    }

    FetchResult<OpenFiscalObservationPayload> fetchBudgetBalancesResult(int startYear, int endYear) {
        return fetchYearlyService("BudgetBalance", startYear, endYear, BUDGET_BALANCE_VALUE_KEYS);
    }

    FetchResult<OpenFiscalObservationPayload> fetchGovernmentDebtMonthsResult(int startYear, int endYear) {
        return fetchYearlyService("GovernmentDebtMonth", startYear, endYear, GOVERNMENT_DEBT_VALUE_KEYS);
    }

    private FetchResult<OpenFiscalObservationPayload> fetchYearlyService(
        String serviceName,
        int startYear,
        int endYear,
        List<String> valueKeyCandidates
    ) {
        if (!StringUtils.hasText(properties.openFiscal().apiKey())) {
            return FetchResult.failure(FetchStatus.NOT_CONFIGURED, "OpenFiscal API key is not configured");
        }

        List<OpenFiscalObservationPayload> observations = new ArrayList<>();
        for (int year = startYear; year <= endYear; year++) {
            int queryYear = year;
            Map<String, Object> request = new TreeMap<>();
            request.put("KEY", properties.openFiscal().apiKey());
            request.put("Type", "json");
            request.put("pIndex", "1");
            request.put("pSize", "1000");
            request.put("OJ_YY", String.valueOf(queryYear));

            String response = restClient.post()
                .uri(uriBuilder -> uriBuilder
                    .path("/openApi/preview/{serviceName}")
                    .build(serviceName))
                .body(request)
                .retrieve()
                .body(String.class);

            FetchResult<OpenFiscalObservationPayload> result = parseObservations(response, valueKeyCandidates);
            if (result.status() != FetchStatus.SUCCESS_EMPTY && result.status() != FetchStatus.SUCCESS_WITH_ROWS) {
                return result;
            }
            observations.addAll(result.rows());
        }

        return FetchResult.success(observations);
    }

    static FetchResult<OpenFiscalObservationPayload> parseObservations(String response, List<String> valueKeyCandidates) {
        if (!StringUtils.hasText(response)) {
            return FetchResult.failure(FetchStatus.PARSE_ERROR, "OpenFiscal response body is empty");
        }
        if (response.trim().startsWith("<")) {
            return FetchResult.failure(FetchStatus.PARSE_ERROR, "OpenFiscal returned non-JSON response");
        }

        try {
            JsonNode root = OBJECT_MAPPER.readTree(response);
            if (root.isTextual()) {
                root = OBJECT_MAPPER.readTree(root.asText());
            }
            if (root.path("RESULT").path("CODE").isTextual() && !"INFO-000".equals(root.path("RESULT").path("CODE").asText())) {
                return FetchResult.failure(FetchStatus.REMOTE_ERROR, root.path("RESULT").path("MESSAGE").asText("OpenFiscal remote error"));
            }
            List<OpenFiscalObservationPayload> observations = new ArrayList<>();
            List<JsonNode> rows = collectRows(root);
            if (rows.isEmpty()) {
                return hasExplicitEmptyArray(root)
                    ? FetchResult.success(List.of())
                    : FetchResult.failure(FetchStatus.SCHEMA_MISMATCH, "OpenFiscal response has no rows with known date fields");
            }

            rows.forEach(row -> parseObservation(row, valueKeyCandidates).ifPresent(observations::add));
            if (observations.isEmpty()) {
                return FetchResult.failure(FetchStatus.SCHEMA_MISMATCH, "OpenFiscal rows are missing required date or value fields");
            }
            return FetchResult.success(observations);
        } catch (Exception exception) {
            return FetchResult.failure(FetchStatus.PARSE_ERROR, exception.getMessage());
        }
    }

    private static boolean hasExplicitEmptyArray(JsonNode node) {
        if (node == null) {
            return false;
        }
        if (node.isArray() && node.isEmpty()) {
            return true;
        }
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                if (hasExplicitEmptyArray(fields.next().getValue())) {
                    return true;
                }
            }
        }
        return false;
    }

    private static List<JsonNode> collectRows(JsonNode node) {
        List<JsonNode> rows = new ArrayList<>();
        collectRows(node, rows);
        return rows;
    }

    private static void collectRows(JsonNode node, List<JsonNode> rows) {
        if (node == null) {
            return;
        }

        if (node.isObject()) {
            if (node.fields().hasNext() && parseDate(node).isPresent()) {
                rows.add(node);
            }
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                collectRows(fields.next().getValue(), rows);
            }
        } else if (node.isArray()) {
            node.forEach(child -> collectRows(child, rows));
        }
    }

    private static Optional<OpenFiscalObservationPayload> parseObservation(JsonNode row, List<String> valueKeyCandidates) {
        Optional<LocalDate> baseDate = parseDate(row);
        Optional<BigDecimal> value = parseValue(row, valueKeyCandidates);
        if (baseDate.isEmpty() || value.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(new OpenFiscalObservationPayload(baseDate.get(), value.get()));
    }

    private static Optional<LocalDate> parseDate(JsonNode row) {
        for (String key : DATE_KEYS) {
            String value = text(row, key);
            if (StringUtils.hasText(value)) {
                String digits = value.replaceAll("[^0-9]", "");
                if (digits.length() >= 6) {
                    return Optional.of(YearMonth.of(
                        Integer.parseInt(digits.substring(0, 4)),
                        Integer.parseInt(digits.substring(4, 6))
                    ).atEndOfMonth());
                }
                if (digits.length() == 4) {
                    return Optional.of(LocalDate.of(Integer.parseInt(digits), 12, 31));
                }
            }
        }

        Optional<Integer> year = firstInteger(row, YEAR_KEYS);
        Optional<Integer> month = firstInteger(row, MONTH_KEYS);
        if (year.isPresent() && month.isPresent() && month.get() >= 1 && month.get() <= 12) {
            return Optional.of(YearMonth.of(year.get(), month.get()).atEndOfMonth());
        }
        return year.map(value -> LocalDate.of(value, 12, 31));
    }

    private static Optional<BigDecimal> parseValue(JsonNode row, List<String> valueKeyCandidates) {
        for (String key : valueKeyCandidates) {
            Optional<BigDecimal> value = decimal(row, key);
            if (value.isPresent()) {
                return value;
            }
        }

        Iterator<Map.Entry<String, JsonNode>> fields = row.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            String key = field.getKey().toUpperCase();
            if (DATE_KEYS.contains(key) || YEAR_KEYS.contains(key) || MONTH_KEYS.contains(key) || key.contains("RNUM")) {
                continue;
            }
            Optional<BigDecimal> value = decimal(field.getValue());
            if (value.isPresent()) {
                return value;
            }
        }
        return Optional.empty();
    }

    private static Optional<Integer> firstInteger(JsonNode row, List<String> keys) {
        for (String key : keys) {
            String value = text(row, key);
            if (StringUtils.hasText(value)) {
                try {
                    return Optional.of(Integer.parseInt(value.replaceAll("[^0-9]", "")));
                } catch (NumberFormatException ignored) {
                    return Optional.empty();
                }
            }
        }
        return Optional.empty();
    }

    private static String text(JsonNode row, String key) {
        JsonNode node = row.get(key);
        if (node == null) {
            node = row.get(key.toLowerCase());
        }
        return node == null || node.isNull() ? null : node.asText();
    }

    private static Optional<BigDecimal> decimal(JsonNode row, String key) {
        JsonNode node = row.get(key);
        if (node == null) {
            node = row.get(key.toLowerCase());
        }
        return decimal(node);
    }

    private static Optional<BigDecimal> decimal(JsonNode node) {
        if (node == null || node.isNull()) {
            return Optional.empty();
        }
        String value = node.asText().replace(",", "").trim();
        if (!StringUtils.hasText(value)) {
            return Optional.empty();
        }
        try {
            return Optional.of(new BigDecimal(value));
        } catch (NumberFormatException ignored) {
            return Optional.empty();
        }
    }

    public record OpenFiscalObservationPayload(LocalDate baseDate, BigDecimal value) {
    }
}
