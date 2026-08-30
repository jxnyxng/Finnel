package com.example.krwwatcher.batch;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.util.StreamUtils;

class SpringBatchMetadataMigrationTest {

    @Test
    void springBatchMetadataMigrationRunsOnH2MysqlMode() throws Exception {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource());
        String sql = StreamUtils.copyToString(
            new ClassPathResource("db/migration/V21__create_spring_batch_metadata.sql").getInputStream(),
            StandardCharsets.UTF_8
        );

        for (String statement : sql.split(";")) {
            if (!statement.isBlank()) {
                jdbcTemplate.execute(statement);
            }
        }

        Integer jobSequenceRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_JOB_SEQ", Integer.class);
        Integer jobExecutionSequenceRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_JOB_EXECUTION_SEQ", Integer.class);
        Integer stepExecutionSequenceRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM BATCH_STEP_EXECUTION_SEQ", Integer.class);
        assertThat(jobSequenceRows).isEqualTo(1);
        assertThat(jobExecutionSequenceRows).isEqualTo(1);
        assertThat(stepExecutionSequenceRows).isEqualTo(1);
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:batch-metadata-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
