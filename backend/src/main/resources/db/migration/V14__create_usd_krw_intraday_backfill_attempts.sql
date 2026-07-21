CREATE TABLE usd_krw_intraday_backfill_attempts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_key VARCHAR(50) NOT NULL,
    currency_pair VARCHAR(20) NOT NULL,
    session_start_date DATE NOT NULL,
    status VARCHAR(40) NOT NULL,
    rows_processed INT NOT NULL DEFAULT 0,
    previous_latest_observed_at TIMESTAMP NULL,
    latest_observed_at TIMESTAMP NULL,
    no_change_count INT NOT NULL DEFAULT 0,
    attempted_at TIMESTAMP NOT NULL,
    next_allowed_at TIMESTAMP NULL,
    message VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_usd_krw_intraday_backfill_session_attempted (session_key, attempted_at),
    KEY idx_usd_krw_intraday_backfill_status (status)
);
