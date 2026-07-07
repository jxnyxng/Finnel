CREATE TABLE intraday_exchange_rates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    observed_at DATETIME NOT NULL,
    currency_pair VARCHAR(20) NOT NULL,
    close_rate DECIMAL(19, 4) NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_intraday_exchange_rates_pair_time (currency_pair, observed_at),
    KEY idx_intraday_exchange_rates_observed_at (observed_at)
);
