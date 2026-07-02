CREATE TABLE effective_exchange_rates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    base_date DATE NOT NULL,
    area_code VARCHAR(20) NOT NULL,
    area_name VARCHAR(100) NOT NULL,
    index_type VARCHAR(20) NOT NULL,
    basket_type VARCHAR(20) NOT NULL,
    value DECIMAL(19, 6) NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_effective_exchange_rates_area_type_date (area_code, index_type, basket_type, base_date),
    KEY idx_effective_exchange_rates_type_date (index_type, basket_type, base_date)
);
