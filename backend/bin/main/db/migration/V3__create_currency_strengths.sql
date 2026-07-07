CREATE TABLE currency_strengths (
    id BIGINT NOT NULL AUTO_INCREMENT,
    base_date DATE NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    currency_name VARCHAR(100) NOT NULL,
    usd_pair VARCHAR(20) NOT NULL,
    usd_per_unit DECIMAL(24, 12) NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_currency_strengths_currency_date (currency_code, base_date),
    KEY idx_currency_strengths_base_date (base_date)
);
