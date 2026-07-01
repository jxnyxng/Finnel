package com.example.krwwatcher.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.krwwatcher.domain.DollarIndex;

public interface DollarIndexRepository extends JpaRepository<DollarIndex, Long> {

    Optional<DollarIndex> findTopBySeriesIdOrderByBaseDateDesc(String seriesId);

    Optional<DollarIndex> findBySeriesIdAndBaseDate(String seriesId, LocalDate baseDate);

    List<DollarIndex> findTop30BySeriesIdOrderByBaseDateDesc(String seriesId);

    List<DollarIndex> findBySeriesIdAndBaseDateGreaterThanEqualOrderByBaseDateAsc(String seriesId, LocalDate baseDate);
}
