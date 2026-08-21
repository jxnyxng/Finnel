UPDATE domestic_policy_indicators
SET indicator_code = 'GLOBAL_CREDIT_SPREAD_PROXY',
    title = '글로벌 신용스프레드 프록시',
    category = '대외 신용위험'
WHERE indicator_code = 'KOREA_CDS';

UPDATE indicator_status_rules
SET indicator_code = 'GLOBAL_CREDIT_SPREAD_PROXY',
    source_filter = 'GLOBAL_CREDIT_SPREAD_PROXY'
WHERE indicator_code = 'KOREA_CDS';

INSERT INTO indicator_status_rules
    (indicator_code, source_table, source_filter, direction, window_months, caution_z, signal_z, min_points)
VALUES
    ('US_TREASURY_1MO', 'domestic_policy_indicators', 'US_TREASURY_1MO', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('US_TREASURY_3MO', 'domestic_policy_indicators', 'US_TREASURY_3MO', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('US_TREASURY_6MO', 'domestic_policy_indicators', 'US_TREASURY_6MO', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('US_TREASURY_1Y', 'domestic_policy_indicators', 'US_TREASURY_1Y', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('US_TREASURY_2Y', 'domestic_policy_indicators', 'US_TREASURY_2Y', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('US_TREASURY_3Y', 'domestic_policy_indicators', 'US_TREASURY_3Y', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('US_TREASURY_5Y', 'domestic_policy_indicators', 'US_TREASURY_5Y', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('US_TREASURY_7Y', 'domestic_policy_indicators', 'US_TREASURY_7Y', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('US_TREASURY_20Y', 'domestic_policy_indicators', 'US_TREASURY_20Y', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('US_TREASURY_30Y', 'domestic_policy_indicators', 'US_TREASURY_30Y', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('SOFR', 'domestic_policy_indicators', 'SOFR', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('SOFR_30D_AVG', 'domestic_policy_indicators', 'SOFR_30D_AVG', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('SOFR_90D_AVG', 'domestic_policy_indicators', 'SOFR_90D_AVG', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('SOFR_180D_AVG', 'domestic_policy_indicators', 'SOFR_180D_AVG', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('SOFR_INDEX', 'domestic_policy_indicators', 'SOFR_INDEX', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('KOFR', 'domestic_policy_indicators', 'KOFR', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('CD_91D', 'domestic_policy_indicators', 'CD_91D', 'RISK_HIGH', 36, 0.8000, 1.5000, 120)
ON DUPLICATE KEY UPDATE
    source_table = VALUES(source_table),
    source_filter = VALUES(source_filter),
    direction = VALUES(direction),
    window_months = VALUES(window_months),
    caution_z = VALUES(caution_z),
    signal_z = VALUES(signal_z),
    min_points = VALUES(min_points),
    enabled = TRUE;
