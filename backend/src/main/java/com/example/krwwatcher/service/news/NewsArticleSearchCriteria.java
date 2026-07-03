package com.example.krwwatcher.service.news;

import java.time.LocalDate;

public record NewsArticleSearchCriteria(
    String categoryCode,
    LocalDate fromDate,
    LocalDate toDate,
    String keyword
) {
}
