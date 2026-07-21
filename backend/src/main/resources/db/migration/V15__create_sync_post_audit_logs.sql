CREATE TABLE sync_post_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    endpoint VARCHAR(200) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    trigger_name VARCHAR(100) NULL,
    caller VARCHAR(100) NULL,
    remote_ip VARCHAR(45) NULL,
    authorized BOOLEAN NOT NULL,
    status_code INT NOT NULL,
    result_status VARCHAR(50) NULL,
    message VARCHAR(1000) NULL,
    requested_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sync_post_audit_logs_requested_at (requested_at),
    KEY idx_sync_post_audit_logs_operation_requested (operation, requested_at),
    KEY idx_sync_post_audit_logs_remote_requested (remote_ip, requested_at)
);
