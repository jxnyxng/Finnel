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
    name = "foreign_reserves",
    uniqueConstraints = @UniqueConstraint(name = "uk_foreign_reserves_base_date", columnNames = "base_date")
)
public class ForeignReserve {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "base_date", nullable = false)
    private LocalDate baseDate;

    @Column(name = "amount_usd_million", nullable = false, precision = 19, scale = 2)
    private BigDecimal amountUsdMillion;

    @Column(nullable = false, length = 50)
    private String source;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected ForeignReserve() {
    }

    public ForeignReserve(LocalDate baseDate, BigDecimal amountUsdMillion, String source, Instant fetchedAt) {
        this.baseDate = baseDate;
        this.amountUsdMillion = amountUsdMillion;
        this.source = source;
        this.fetchedAt = fetchedAt;
    }

    public LocalDate getBaseDate() {
        return baseDate;
    }

    public BigDecimal getAmountUsdMillion() {
        return amountUsdMillion;
    }

    public String getSource() {
        return source;
    }

    public Instant getFetchedAt() {
        return fetchedAt;
    }
}
