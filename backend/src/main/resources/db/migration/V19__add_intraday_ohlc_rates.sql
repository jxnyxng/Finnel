ALTER TABLE intraday_exchange_rates
    ADD COLUMN open_rate DECIMAL(19, 4) NULL AFTER currency_pair,
    ADD COLUMN high_rate DECIMAL(19, 4) NULL AFTER open_rate,
    ADD COLUMN low_rate DECIMAL(19, 4) NULL AFTER high_rate;

UPDATE intraday_exchange_rates
SET open_rate = close_rate,
    high_rate = close_rate,
    low_rate = close_rate
WHERE open_rate IS NULL
   OR high_rate IS NULL
   OR low_rate IS NULL;

ALTER TABLE intraday_exchange_rates
    MODIFY open_rate DECIMAL(19, 4) NOT NULL,
    MODIFY high_rate DECIMAL(19, 4) NOT NULL,
    MODIFY low_rate DECIMAL(19, 4) NOT NULL;
