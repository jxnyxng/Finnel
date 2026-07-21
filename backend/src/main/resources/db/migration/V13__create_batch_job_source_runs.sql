CREATE TABLE batch_job_source_runs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    batch_job_run_id BIGINT NULL,
    job_name VARCHAR(100) NOT NULL,
    source_name VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    rows_processed INT NOT NULL DEFAULT 0,
    error_code VARCHAR(100) NULL,
    error_message VARCHAR(1000) NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_batch_job_source_runs_job_source_started (job_name, source_name, started_at),
    KEY idx_batch_job_source_runs_status (status),
    CONSTRAINT fk_batch_job_source_runs_job
        FOREIGN KEY (batch_job_run_id) REFERENCES batch_job_runs (id)
        ON DELETE SET NULL
);
