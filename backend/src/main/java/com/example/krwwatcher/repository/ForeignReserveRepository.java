package com.example.krwwatcher.repository;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.krwwatcher.domain.ForeignReserve;

public interface ForeignReserveRepository extends JpaRepository<ForeignReserve, Long> {

    Optional<ForeignReserve> findTopByOrderByBaseDateDesc();

    Optional<ForeignReserve> findTopByBaseDateBeforeOrderByBaseDateDesc(LocalDate baseDate);

    Optional<ForeignReserve> findByBaseDate(LocalDate baseDate);
}
