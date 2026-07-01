CREATE TABLE exchange_rates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    base_date DATE NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    currency_name VARCHAR(100) NOT NULL,
    deal_bas_rate DECIMAL(19, 4) NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_exchange_rates_currency_date (currency_code, base_date),
    KEY idx_exchange_rates_base_date (base_date)
);

CREATE TABLE dollar_indexes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    base_date DATE NOT NULL,
    series_id VARCHAR(50) NOT NULL,
    value DECIMAL(19, 6) NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_dollar_indexes_series_date (series_id, base_date),
    KEY idx_dollar_indexes_base_date (base_date)
);

CREATE TABLE interest_rates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    base_date DATE NOT NULL,
    country_code VARCHAR(10) NOT NULL,
    rate_type VARCHAR(50) NOT NULL,
    rate_value DECIMAL(9, 4) NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_interest_rates_country_type_date (country_code, rate_type, base_date),
    KEY idx_interest_rates_base_date (base_date)
);

CREATE TABLE foreign_reserves (
    id BIGINT NOT NULL AUTO_INCREMENT,
    base_date DATE NOT NULL,
    amount_usd_million DECIMAL(19, 2) NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_foreign_reserves_base_date (base_date)
);

CREATE TABLE batch_job_runs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NULL,
    message VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_batch_job_runs_job_started_at (job_name, started_at),
    KEY idx_batch_job_runs_status (status)
);
