package com.example.krwwatcher.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "interest_rates",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_interest_rates_country_type_date",
        columnNames = {"country_code", "rate_type", "base_date"}
    )
)
public class InterestRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "base_date", nullable = false)
    private LocalDate baseDate;

    @Column(name = "country_code", nullable = false, length = 10)
    private String countryCode;

    @Column(name = "rate_type", nullable = false, length = 50)
    private String rateType;

    @Column(name = "rate_value", nullable = false, precision = 9, scale = 4)
    private BigDecimal rateValue;

    @Column(nullable = false, length = 50)
    private String source;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected InterestRate() {
    }

    public InterestRate(LocalDate baseDate, String countryCode, String rateType, BigDecimal rateValue, String source, Instant fetchedAt) {
        this.baseDate = baseDate;
        this.countryCode = countryCode;
        this.rateType = rateType;
        this.rateValue = rateValue;
        this.source = source;
        this.fetchedAt = fetchedAt;
    }

    public LocalDate getBaseDate() {
        return baseDate;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public String getRateType() {
        return rateType;
    }

    public BigDecimal getRateValue() {
        return rateValue;
    }
}
