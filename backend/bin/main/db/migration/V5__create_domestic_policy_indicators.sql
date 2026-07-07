CREATE TABLE domestic_policy_indicators (
    id BIGINT NOT NULL AUTO_INCREMENT,
    indicator_code VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    base_date DATE NOT NULL,
    value DECIMAL(19, 4) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    source VARCHAR(80) NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_domestic_policy_indicator_date (indicator_code, base_date),
    KEY idx_domestic_policy_indicators_category (category),
    KEY idx_domestic_policy_indicators_base_date (base_date)
);
