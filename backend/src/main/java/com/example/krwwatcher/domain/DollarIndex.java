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
    name = "dollar_indexes",
    uniqueConstraints = @UniqueConstraint(name = "uk_dollar_indexes_series_date", columnNames = {"series_id", "base_date"})
)
public class DollarIndex {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "base_date", nullable = false)
    private LocalDate baseDate;

    @Column(name = "series_id", nullable = false, length = 50)
    private String seriesId;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal value;

    @Column(nullable = false, length = 50)
    private String source;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected DollarIndex() {
    }

    public DollarIndex(LocalDate baseDate, String seriesId, BigDecimal value, String source, Instant fetchedAt) {
        this.baseDate = baseDate;
        this.seriesId = seriesId;
        this.value = value;
        this.source = source;
        this.fetchedAt = fetchedAt;
    }

    public LocalDate getBaseDate() {
        return baseDate;
    }

    public String getSeriesId() {
        return seriesId;
    }

    public BigDecimal getValue() {
        return value;
    }

    public Instant getFetchedAt() {
        return fetchedAt;
    }
}
