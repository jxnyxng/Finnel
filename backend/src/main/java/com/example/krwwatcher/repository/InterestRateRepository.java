package com.example.krwwatcher.repository;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.krwwatcher.domain.InterestRate;

public interface InterestRateRepository extends JpaRepository<InterestRate, Long> {

    Optional<InterestRate> findTopByCountryCodeAndRateTypeOrderByBaseDateDesc(String countryCode, String rateType);

    Optional<InterestRate> findTopByCountryCodeAndRateTypeAndBaseDateBeforeOrderByBaseDateDesc(String countryCode, String rateType, LocalDate baseDate);

    Optional<InterestRate> findByCountryCodeAndRateTypeAndBaseDate(String countryCode, String rateType, LocalDate baseDate);
}
