package com.example.krwwatcher.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IndicatorStatusAnalysisService {

    private final JdbcTemplate jdbcTemplate;

    public IndicatorStatusAnalysisService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public int refreshAll() {
        return findEnabledRules().stream()
            .mapToInt(rule -> upsertSnapshot(analyze(rule, null, null)))
            .sum();
    }

    public IndicatorStatus evaluate(String code, BigDecimal currentValue, LocalDate baseDate) {
        StatusRule rule = findRule(code);
        if (rule == null) {
            return findSnapshot(code);
        }

        if (currentValue == null) {
            return new IndicatorStatus("NO_DATA", "현재 수치가 없어 과거 평균과 비교하지 못했습니다.");
        }

        return analyze(rule, currentValue, baseDate);
    }

    public IndicatorStatus findSnapshot(String code) {
        return jdbcTemplate.query(
            """
                SELECT status, status_reason
                FROM indicator_status_snapshots
                WHERE indicator_code = ?
                """,
            (rs, rowNum) -> new IndicatorStatus(rs.getString("status"), rs.getString("status_reason")),
            code
        ).stream().findFirst().orElse(new IndicatorStatus("NO_DATA", "분석 스냅샷이 아직 생성되지 않았습니다."));
    }

    private IndicatorStatus analyze(StatusRule rule, BigDecimal overrideValue, LocalDate overrideBaseDate) {
        SeriesPoint latest = overrideValue == null ? findLatestPoint(rule) : new SeriesPoint(overrideBaseDate, overrideValue);
        if (latest == null || latest.value() == null) {
            return new IndicatorStatus(rule.code(), null, null, null, null, 0, null, null, null, null, "NO_DATA", "현재 수치가 없어 과거 평균과 비교하지 못했습니다.");
        }

        LocalDate windowEnd = latest.baseDate() == null ? LocalDate.now() : latest.baseDate();
        LocalDate windowStart = windowEnd.minusMonths(rule.windowMonths());
        List<BigDecimal> values = findWindowValues(rule, windowStart, windowEnd).stream()
            .filter(Objects::nonNull)
            .toList();

        if (values.size() < rule.minPoints()) {
            String reason = "분석 표본이 " + values.size() + "개로 기준 " + rule.minPoints() + "개보다 적어 상태를 보류했습니다.";
            return new IndicatorStatus(rule.code(), latest.baseDate(), latest.value(), windowStart, windowEnd, values.size(), null, null, null, null, "NO_DATA", reason);
        }

        BigDecimal average = average(values);
        BigDecimal stddev = standardDeviation(values, average);
        BigDecimal delta = latest.value().subtract(average);
        BigDecimal zScore = isZero(stddev) ? BigDecimal.ZERO : delta.divide(stddev, 6, RoundingMode.HALF_UP);
        BigDecimal deviationPercent = isZero(average)
            ? null
            : delta.divide(average.abs(), 6, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));
        StatusDecision decision = decide(rule, zScore);
        String reason = buildReason(rule, latest.value(), average, zScore, deviationPercent, values.size(), decision);

        return new IndicatorStatus(rule.code(), latest.baseDate(), latest.value(), windowStart, windowEnd, values.size(), average, stddev, zScore, deviationPercent, decision.status(), reason);
    }

    private StatusDecision decide(StatusRule rule, BigDecimal zScore) {
        int polarity = switch (rule.direction()) {
            case "RISK_HIGH" -> zScore.compareTo(BigDecimal.ZERO);
            case "BENEFIT_HIGH" -> zScore.negate().compareTo(BigDecimal.ZERO);
            default -> 0;
        };
        BigDecimal magnitude = zScore.abs();
        if (magnitude.compareTo(rule.signalZ()) >= 0) {
            return polarity > 0
                ? new StatusDecision("NEGATIVE", "부정")
                : new StatusDecision("POSITIVE", "긍정");
        }
        if (magnitude.compareTo(rule.cautionZ()) >= 0) {
            return polarity > 0
                ? new StatusDecision("CAUTION", "주의")
                : new StatusDecision("POSITIVE", "긍정");
        }
        return new StatusDecision("NEUTRAL", "보합");
    }

    private String buildReason(
        StatusRule rule,
        BigDecimal currentValue,
        BigDecimal average,
        BigDecimal zScore,
        BigDecimal deviationPercent,
        int sampleCount,
        StatusDecision decision
    ) {
        String directionText = "RISK_HIGH".equals(rule.direction())
            ? "높을수록 원화에 부담인 지표"
            : "높을수록 원화에 우호적인 지표";
        String percentText = deviationPercent == null
            ? "평균 대비 비율 산출 불가"
            : "평균 대비 " + signed(deviationPercent, 1) + "%";
        return directionText + "입니다. 최근 " + rule.windowMonths() + "개월 표본 " + sampleCount
            + "개의 평균 " + format(average, 2)
            + " 대비 현재 " + format(currentValue, 2)
            + "로 " + percentText
            + ", z-score " + signed(zScore, 2)
            + "라서 " + labelWithParticle(decision.label()) + " 분류했습니다.";
    }

    private int upsertSnapshot(IndicatorStatus status) {
        return jdbcTemplate.update("""
                INSERT INTO indicator_status_snapshots (
                    indicator_code, base_date, current_value, window_start_date, window_end_date,
                    sample_count, average_value, standard_deviation, z_score, deviation_percent,
                    status, status_reason, calculated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    base_date = VALUES(base_date),
                    current_value = VALUES(current_value),
                    window_start_date = VALUES(window_start_date),
                    window_end_date = VALUES(window_end_date),
                    sample_count = VALUES(sample_count),
                    average_value = VALUES(average_value),
                    standard_deviation = VALUES(standard_deviation),
                    z_score = VALUES(z_score),
                    deviation_percent = VALUES(deviation_percent),
                    status = VALUES(status),
                    status_reason = VALUES(status_reason),
                    calculated_at = VALUES(calculated_at)
                """,
            status.code(),
            status.baseDate(),
            status.currentValue(),
            status.windowStartDate(),
            status.windowEndDate(),
            status.sampleCount(),
            status.averageValue(),
            status.standardDeviation(),
            status.zScore(),
            status.deviationPercent(),
            status.status(),
            status.statusReason(),
            Instant.now()
        );
    }

    private StatusRule findRule(String code) {
        return jdbcTemplate.query(
            """
                SELECT indicator_code, source_table, source_filter, direction, window_months, caution_z, signal_z, min_points
                FROM indicator_status_rules
                WHERE indicator_code = ?
                  AND enabled = TRUE
                """,
            (rs, rowNum) -> new StatusRule(
                rs.getString("indicator_code"),
                rs.getString("source_table"),
                rs.getString("source_filter"),
                rs.getString("direction"),
                rs.getInt("window_months"),
                rs.getBigDecimal("caution_z"),
                rs.getBigDecimal("signal_z"),
                rs.getInt("min_points")
            ),
            code
        ).stream().findFirst().orElse(null);
    }

    private List<StatusRule> findEnabledRules() {
        return jdbcTemplate.query(
            """
                SELECT indicator_code, source_table, source_filter, direction, window_months, caution_z, signal_z, min_points
                FROM indicator_status_rules
                WHERE enabled = TRUE
                ORDER BY indicator_code
                """,
            (rs, rowNum) -> new StatusRule(
                rs.getString("indicator_code"),
                rs.getString("source_table"),
                rs.getString("source_filter"),
                rs.getString("direction"),
                rs.getInt("window_months"),
                rs.getBigDecimal("caution_z"),
                rs.getBigDecimal("signal_z"),
                rs.getInt("min_points")
            )
        );
    }

    private SeriesPoint findLatestPoint(StatusRule rule) {
        return switch (rule.sourceTable()) {
            case "exchange_rates" -> queryLatest("SELECT base_date, deal_bas_rate FROM exchange_rates WHERE currency_code = ? ORDER BY base_date DESC LIMIT 1", rule.sourceFilter());
            case "interest_rates" -> {
                String[] filter = rule.sourceFilter().split(":", 2);
                yield queryLatest("SELECT base_date, rate_value FROM interest_rates WHERE country_code = ? AND rate_type = ? ORDER BY base_date DESC LIMIT 1", filter[0], filter[1]);
            }
            case "foreign_reserves" -> queryLatest("SELECT base_date, amount_usd_million FROM foreign_reserves ORDER BY base_date DESC LIMIT 1");
            case "effective_exchange_rates" -> findLatestKrwNeerRank();
            case "domestic_policy_indicators" -> queryLatest("SELECT base_date, value FROM domestic_policy_indicators WHERE indicator_code = ? ORDER BY base_date DESC LIMIT 1", rule.sourceFilter());
            case "derived" -> findLatestRateGap();
            default -> null;
        };
    }

    private List<BigDecimal> findWindowValues(StatusRule rule, LocalDate startDate, LocalDate endDate) {
        return switch (rule.sourceTable()) {
            case "exchange_rates" -> queryValues("SELECT deal_bas_rate FROM exchange_rates WHERE currency_code = ? AND base_date >= ? AND base_date < ? ORDER BY base_date", rule.sourceFilter(), startDate, endDate);
            case "interest_rates" -> {
                String[] filter = rule.sourceFilter().split(":", 2);
                yield queryValues("SELECT rate_value FROM interest_rates WHERE country_code = ? AND rate_type = ? AND base_date >= ? AND base_date < ? ORDER BY base_date", filter[0], filter[1], startDate, endDate);
            }
            case "foreign_reserves" -> queryValues("SELECT amount_usd_million FROM foreign_reserves WHERE base_date >= ? AND base_date < ? ORDER BY base_date", startDate, endDate);
            case "effective_exchange_rates" -> findKrwNeerRankValues(startDate, endDate);
            case "domestic_policy_indicators" -> queryValues("SELECT value FROM domestic_policy_indicators WHERE indicator_code = ? AND base_date >= ? AND base_date < ? ORDER BY base_date", rule.sourceFilter(), startDate, endDate);
            case "derived" -> findRateGapValues(startDate, endDate);
            default -> List.of();
        };
    }

    private SeriesPoint queryLatest(String sql, Object... params) {
        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new SeriesPoint(rs.getDate(1).toLocalDate(), rs.getBigDecimal(2)),
            params
        ).stream().findFirst().orElse(null);
    }

    private List<BigDecimal> queryValues(String sql, Object... params) {
        return jdbcTemplate.query(sql, (rs, rowNum) -> rs.getBigDecimal(1), params);
    }

    private SeriesPoint findLatestRateGap() {
        return jdbcTemplate.query(
            """
                SELECT us.base_date, us.rate_value - kr.rate_value
                FROM interest_rates us
                JOIN interest_rates kr
                  ON kr.country_code = 'KR'
                 AND kr.rate_type = 'POLICY_RATE'
                 AND kr.base_date = (
                    SELECT MAX(base_date)
                    FROM interest_rates
                    WHERE country_code = 'KR'
                      AND rate_type = 'POLICY_RATE'
                      AND base_date <= us.base_date
                 )
                WHERE us.country_code = 'US'
                  AND us.rate_type = 'POLICY_RATE'
                ORDER BY us.base_date DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new SeriesPoint(rs.getDate(1).toLocalDate(), rs.getBigDecimal(2))
        ).stream().findFirst().orElse(null);
    }

    private List<BigDecimal> findRateGapValues(LocalDate startDate, LocalDate endDate) {
        return jdbcTemplate.query(
            """
                SELECT us.rate_value - kr.rate_value
                FROM interest_rates us
                JOIN interest_rates kr
                  ON kr.country_code = 'KR'
                 AND kr.rate_type = 'POLICY_RATE'
                 AND kr.base_date = (
                    SELECT MAX(base_date)
                    FROM interest_rates
                    WHERE country_code = 'KR'
                      AND rate_type = 'POLICY_RATE'
                      AND base_date <= us.base_date
                 )
                WHERE us.country_code = 'US'
                  AND us.rate_type = 'POLICY_RATE'
                  AND us.base_date >= ?
                  AND us.base_date < ?
                ORDER BY us.base_date
                """,
            (rs, rowNum) -> rs.getBigDecimal(1),
            startDate,
            endDate
        );
    }

    private SeriesPoint findLatestKrwNeerRank() {
        return jdbcTemplate.query(
            """
                SELECT ranked.base_date, ranked.neer_rank
                FROM (
                    SELECT base_date, area_code, ROW_NUMBER() OVER (PARTITION BY base_date ORDER BY value ASC) AS neer_rank
                    FROM effective_exchange_rates
                    WHERE index_type = 'N'
                      AND basket_type = 'B'
                ) ranked
                WHERE ranked.area_code = 'KR'
                ORDER BY ranked.base_date DESC
                LIMIT 1
                """,
            (rs, rowNum) -> new SeriesPoint(rs.getDate("base_date").toLocalDate(), rs.getBigDecimal("neer_rank"))
        ).stream().findFirst().orElse(null);
    }

    private List<BigDecimal> findKrwNeerRankValues(LocalDate startDate, LocalDate endDate) {
        return jdbcTemplate.query(
            """
                SELECT ranked.neer_rank
                FROM (
                    SELECT base_date, area_code, ROW_NUMBER() OVER (PARTITION BY base_date ORDER BY value ASC) AS neer_rank
                    FROM effective_exchange_rates
                    WHERE index_type = 'N'
                      AND basket_type = 'B'
                      AND base_date >= ?
                      AND base_date < ?
                ) ranked
                WHERE ranked.area_code = 'KR'
                ORDER BY ranked.base_date
                """,
            (rs, rowNum) -> rs.getBigDecimal("neer_rank"),
            startDate,
            endDate
        );
    }

    private BigDecimal average(List<BigDecimal> values) {
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 8, RoundingMode.HALF_UP);
    }

    private BigDecimal standardDeviation(List<BigDecimal> values, BigDecimal average) {
        BigDecimal variance = values.stream()
            .map(value -> value.subtract(average))
            .map(delta -> delta.multiply(delta))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(values.size()), 8, RoundingMode.HALF_UP);
        return BigDecimal.valueOf(Math.sqrt(variance.doubleValue())).setScale(8, RoundingMode.HALF_UP);
    }

    private boolean isZero(BigDecimal value) {
        return value == null || value.compareTo(BigDecimal.ZERO) == 0;
    }

    private String signed(BigDecimal value, int scale) {
        BigDecimal scaled = value.setScale(scale, RoundingMode.HALF_UP);
        return scaled.signum() > 0 ? "+" + scaled.toPlainString() : scaled.toPlainString();
    }

    private String format(BigDecimal value, int scale) {
        return value.setScale(scale, RoundingMode.HALF_UP).toPlainString();
    }

    private String labelWithParticle(String label) {
        return "주의".equals(label) ? label + "로" : label + "으로";
    }

    private record StatusRule(
        String code,
        String sourceTable,
        String sourceFilter,
        String direction,
        int windowMonths,
        BigDecimal cautionZ,
        BigDecimal signalZ,
        int minPoints
    ) {
    }

    private record SeriesPoint(LocalDate baseDate, BigDecimal value) {
    }

    private record StatusDecision(String status, String label) {
    }

    public record IndicatorStatus(
        String code,
        LocalDate baseDate,
        BigDecimal currentValue,
        LocalDate windowStartDate,
        LocalDate windowEndDate,
        int sampleCount,
        BigDecimal averageValue,
        BigDecimal standardDeviation,
        BigDecimal zScore,
        BigDecimal deviationPercent,
        String status,
        String statusReason
    ) {
        public IndicatorStatus(String status, String statusReason) {
            this(null, null, null, null, null, 0, null, null, null, null, status, statusReason);
        }
    }
}
