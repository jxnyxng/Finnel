package com.example.krwwatcher.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.krwwatcher.domain.ExchangeRate;

public interface ExchangeRateRepository extends JpaRepository<ExchangeRate, Long> {

    Optional<ExchangeRate> findTopByCurrencyCodeOrderByBaseDateDesc(String currencyCode);

    Optional<ExchangeRate> findByCurrencyCodeAndBaseDate(String currencyCode, LocalDate baseDate);

    List<ExchangeRate> findTop30ByCurrencyCodeOrderByBaseDateDesc(String currencyCode);

    List<ExchangeRate> findByCurrencyCodeAndBaseDateGreaterThanEqualOrderByBaseDateAsc(String currencyCode, LocalDate baseDate);
}
