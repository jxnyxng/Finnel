CREATE TABLE korean_public_holidays (
    id BIGINT NOT NULL AUTO_INCREMENT,
    calendar_year INT NOT NULL,
    holiday_date DATE NOT NULL,
    source VARCHAR(50) NOT NULL,
    synced_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_korean_public_holidays_date (holiday_date),
    KEY idx_korean_public_holidays_year (calendar_year)
);

CREATE TABLE korean_holiday_calendar_syncs (
    calendar_year INT NOT NULL,
    status VARCHAR(30) NOT NULL,
    last_synced_at TIMESTAMP NULL,
    message VARCHAR(1000) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (calendar_year),
    KEY idx_korean_holiday_calendar_syncs_status (status)
);
