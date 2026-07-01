package com.example.krwwatcher.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.krwwatcher.domain.BatchJobRun;

public interface BatchJobRunRepository extends JpaRepository<BatchJobRun, Long> {
}
