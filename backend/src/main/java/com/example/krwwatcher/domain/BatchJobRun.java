package com.example.krwwatcher.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "batch_job_runs")
public class BatchJobRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_name", nullable = false, length = 100)
    private String jobName;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(length = 1000)
    private String message;

    protected BatchJobRun() {
    }

    public BatchJobRun(String jobName, String status, Instant startedAt, Instant endedAt, String message) {
        this.jobName = jobName;
        this.status = status;
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.message = message;
    }
}
