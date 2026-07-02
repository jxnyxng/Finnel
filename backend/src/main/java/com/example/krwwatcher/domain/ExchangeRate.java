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
    name = "exchange_rates",
    uniqueConstraints = @UniqueConstraint(name = "uk_exchange_rates_currency_date", columnNames = {"currency_code", "base_date"})
)
public class ExchangeRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "base_date", nullable = false)
    private LocalDate baseDate;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode;

    @Column(name = "currency_name", nullable = false, length = 100)
    private String currencyName;

    @Column(name = "deal_bas_rate", nullable = false, precision = 19, scale = 4)
    private BigDecimal dealBasRate;

    @Column(nullable = false, length = 50)
    private String source;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected ExchangeRate() {
    }

    public ExchangeRate(LocalDate baseDate, String currencyCode, String currencyName, BigDecimal dealBasRate, String source, Instant fetchedAt) {
        this.baseDate = baseDate;
        this.currencyCode = currencyCode;
        this.currencyName = currencyName;
        this.dealBasRate = dealBasRate;
        this.source = source;
        this.fetchedAt = fetchedAt;
    }

    public LocalDate getBaseDate() {
        return baseDate;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public BigDecimal getDealBasRate() {
        return dealBasRate;
    }

    public String getSource() {
        return source;
    }

    public Instant getFetchedAt() {
        return fetchedAt;
    }
}
