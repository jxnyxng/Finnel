package com.example.krwwatcher.batch;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:batch-runtime-validation;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.enabled=false",
        "spring.batch.job.enabled=false",
        "spring.batch.jdbc.initialize-schema=always",
        "app.sync.market-data.enabled=false",
        "app.sync.content.enabled=false",
        "app.sync.market-data.post-security.admin-token=secret",
        "app.sync.market-data.post-security.backfill-rate-limit-cooldown=0s"
    }
)
@DirtiesContext
class BatchRuntimeValidationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    @SuppressWarnings("unchecked")
    void batchRuntimeMetadataEndpointReportsManualExecution() {
        assertBatchMetadataTablesExist();
        createAuditTables();

        ResponseEntity<Map> syncResponse = restTemplate.exchange(
            "/api/v1/sync/market-data",
            HttpMethod.POST,
            new HttpEntity<>(adminHeaders()),
            Map.class
        );
        assertThat(syncResponse.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(syncResponse.getBody()).containsEntry("status", "SKIPPED_DISABLED");

        Integer jobExecutions = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_JOB_EXECUTION", Integer.class);
        Integer stepExecutions = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_STEP_EXECUTION", Integer.class);
        assertThat(jobExecutions).isEqualTo(1);
        assertThat(stepExecutions).isEqualTo(1);

        ResponseEntity<Map> jobsResponse = restTemplate.getForEntity("/api/v1/sync/batch/jobs", Map.class);

        assertThat(jobsResponse.getStatusCode().is2xxSuccessful()).isTrue();
        List<Map<String, Object>> jobs = (List<Map<String, Object>>) jobsResponse.getBody().get("jobs");
        Map<String, Object> marketJob = jobs.stream()
            .filter(job -> BatchJobNames.MARKET_DATA_SYNC.equals(job.get("jobName")))
            .findFirst()
            .orElseThrow();
        Map<String, Object> latestExecution = (Map<String, Object>) marketJob.get("latestExecution");
        assertThat(latestExecution).containsEntry("jobName", BatchJobNames.MARKET_DATA_SYNC);
        assertThat(latestExecution).containsEntry("status", "COMPLETED");
        assertThat(latestExecution).containsEntry("exitCode", "SKIPPED_DISABLED");

        ResponseEntity<Map> latestResponse = restTemplate.getForEntity(
            "/api/v1/sync/batch/jobs/{jobName}/latest",
            Map.class,
            BatchJobNames.MARKET_DATA_SYNC
        );
        assertThat(latestResponse.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat((Map<String, Object>) latestResponse.getBody().get("latestExecution"))
            .containsEntry("jobName", BatchJobNames.MARKET_DATA_SYNC);
    }

    private void assertBatchMetadataTablesExist() {
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_JOB_INSTANCE", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_JOB_EXECUTION", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_STEP_EXECUTION", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_JOB_EXECUTION_PARAMS", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_JOB_EXECUTION_CONTEXT", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_STEP_EXECUTION_CONTEXT", Integer.class)).isZero();
    }

    private void createAuditTables() {
        jdbcTemplate.execute("""
            CREATE TABLE batch_job_runs (
                id BIGINT NOT NULL AUTO_INCREMENT,
                job_name VARCHAR(100) NOT NULL,
                status VARCHAR(30) NOT NULL,
                started_at TIMESTAMP NOT NULL,
                ended_at TIMESTAMP NULL,
                message VARCHAR(1000) NULL,
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
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
                PRIMARY KEY (id)
            )
            """);
        jdbcTemplate.execute("""
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
                PRIMARY KEY (id)
            )
            """);
    }

    private HttpHeaders adminHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("secret");
        return headers;
    }
}
