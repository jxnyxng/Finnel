CREATE TABLE indicator_status_rules (
    indicator_code VARCHAR(50) NOT NULL,
    source_table VARCHAR(50) NOT NULL,
    source_filter VARCHAR(100) NOT NULL,
    direction VARCHAR(30) NOT NULL,
    window_months INT NOT NULL,
    caution_z DECIMAL(8, 4) NOT NULL DEFAULT 0.8000,
    signal_z DECIMAL(8, 4) NOT NULL DEFAULT 1.5000,
    min_points INT NOT NULL DEFAULT 6,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (indicator_code)
);

CREATE TABLE indicator_status_snapshots (
    indicator_code VARCHAR(50) NOT NULL,
    base_date DATE NULL,
    current_value DECIMAL(19, 6) NULL,
    window_start_date DATE NULL,
    window_end_date DATE NULL,
    sample_count INT NOT NULL DEFAULT 0,
    average_value DECIMAL(19, 6) NULL,
    standard_deviation DECIMAL(19, 6) NULL,
    z_score DECIMAL(12, 6) NULL,
    deviation_percent DECIMAL(12, 4) NULL,
    status VARCHAR(20) NOT NULL,
    status_reason VARCHAR(500) NOT NULL,
    calculated_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (indicator_code),
    KEY idx_indicator_status_snapshots_status (status),
    KEY idx_indicator_status_snapshots_calculated_at (calculated_at)
);

INSERT INTO indicator_status_rules
    (indicator_code, source_table, source_filter, direction, window_months, caution_z, signal_z, min_points)
VALUES
    ('USD_KRW', 'exchange_rates', 'USD', 'RISK_HIGH', 12, 0.8000, 1.5000, 120),
    ('KR_POLICY_RATE', 'interest_rates', 'KR:POLICY_RATE', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 6),
    ('US_POLICY_RATE', 'interest_rates', 'US:POLICY_RATE', 'RISK_HIGH', 36, 0.8000, 1.5000, 6),
    ('KR_US_RATE_GAP', 'derived', 'KR_US_RATE_GAP', 'RISK_HIGH', 36, 0.8000, 1.5000, 6),
    ('FOREIGN_RESERVES', 'foreign_reserves', '*', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 12),
    ('KR_NEER_RANK', 'effective_exchange_rates', 'KR:B:N', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 12),
    ('M2', 'domestic_policy_indicators', 'M2', 'RISK_HIGH', 36, 0.8000, 1.5000, 12),
    ('CURRENT_ACCOUNT', 'domestic_policy_indicators', 'CURRENT_ACCOUNT', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 12),
    ('GOODS_ACCOUNT', 'domestic_policy_indicators', 'GOODS_ACCOUNT', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 12),
    ('CPI', 'domestic_policy_indicators', 'CPI', 'RISK_HIGH', 36, 0.8000, 1.5000, 12),
    ('PPI', 'domestic_policy_indicators', 'PPI', 'RISK_HIGH', 36, 0.8000, 1.5000, 12),
    ('EXPORT_AMOUNT', 'domestic_policy_indicators', 'EXPORT_AMOUNT', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 12),
    ('IMPORT_AMOUNT', 'domestic_policy_indicators', 'IMPORT_AMOUNT', 'RISK_HIGH', 36, 0.8000, 1.5000, 12),
    ('TRADE_BALANCE', 'domestic_policy_indicators', 'TRADE_BALANCE', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 12),
    ('FISCAL_BALANCE', 'domestic_policy_indicators', 'FISCAL_BALANCE', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 12),
    ('GOVERNMENT_DEBT', 'domestic_policy_indicators', 'GOVERNMENT_DEBT', 'RISK_HIGH', 36, 0.8000, 1.5000, 12),
    ('FOREIGN_STOCK_FLOW', 'domestic_policy_indicators', 'FOREIGN_STOCK_FLOW', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 12),
    ('FOREIGN_BOND_FLOW', 'domestic_policy_indicators', 'FOREIGN_BOND_FLOW', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 6),
    ('TERMS_OF_TRADE', 'domestic_policy_indicators', 'TERMS_OF_TRADE', 'BENEFIT_HIGH', 36, 0.8000, 1.5000, 12),
    ('US_10Y_TREASURY', 'domestic_policy_indicators', 'US_10Y_TREASURY', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('VIX', 'domestic_policy_indicators', 'VIX', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('WTI_OIL', 'domestic_policy_indicators', 'WTI_OIL', 'RISK_HIGH', 36, 0.8000, 1.5000, 120),
    ('KOREA_CDS', 'domestic_policy_indicators', 'KOREA_CDS', 'RISK_HIGH', 36, 0.8000, 1.5000, 120);
