CREATE TABLE current_exchange_rates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    base_date DATE NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    currency_name VARCHAR(100) NOT NULL,
    deal_bas_rate DECIMAL(19, 4) NOT NULL,
    source VARCHAR(50) NOT NULL,
    observed_at TIMESTAMP NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_current_exchange_rates_currency (currency_code),
    KEY idx_current_exchange_rates_base_date (base_date),
    KEY idx_current_exchange_rates_observed_at (observed_at)
);

INSERT INTO current_exchange_rates (base_date, currency_code, currency_name, deal_bas_rate, source, observed_at, fetched_at)
SELECT er.base_date, er.currency_code, er.currency_name, er.deal_bas_rate, er.source, er.fetched_at, er.fetched_at
FROM exchange_rates er
WHERE er.source LIKE 'TWELVE_DATA:exchange_rate:%'
  AND er.id = (
      SELECT er2.id
      FROM exchange_rates er2
      WHERE er2.currency_code = er.currency_code
        AND er2.source LIKE 'TWELVE_DATA:exchange_rate:%'
      ORDER BY er2.fetched_at DESC, er2.id DESC
      LIMIT 1
  );

DELETE FROM exchange_rates
WHERE source LIKE 'TWELVE_DATA:exchange_rate:%';
