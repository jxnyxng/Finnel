package com.example.krwwatcher.service;

import java.sql.ResultSet;
import java.sql.SQLException;

// Maps government briefing query rows to API article DTOs.
class GovernmentBriefingArticleMapper {

    GovernmentBriefingService.GovernmentBriefingArticle mapArticle(ResultSet rs) throws SQLException {
        return new GovernmentBriefingService.GovernmentBriefingArticle(
            rs.getString("title"),
            rs.getString("subtitle"),
            rs.getString("body"),
            rs.getString("ministry"),
            rs.getString("category"),
            rs.getTimestamp("published_at") == null ? null : rs.getTimestamp("published_at").toInstant(),
            rs.getString("thumbnail_url"),
            rs.getString("image_url"),
            rs.getString("original_url"),
            rs.getString("kogl_type"),
            rs.getTimestamp("fetched_at").toInstant()
        );
    }
}
