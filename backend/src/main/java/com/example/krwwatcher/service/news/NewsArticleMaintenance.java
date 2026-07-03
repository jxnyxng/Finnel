package com.example.krwwatcher.service.news;

import java.time.Instant;
import java.util.List;

import com.example.krwwatcher.external.NewsImageClient;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class NewsArticleMaintenance {

    private final JdbcTemplate jdbcTemplate;
    private final NewsImageClient newsImageClient;
    private final NewsArticleText newsArticleText;

    public NewsArticleMaintenance(JdbcTemplate jdbcTemplate, NewsImageClient newsImageClient, NewsArticleText newsArticleText) {
        this.jdbcTemplate = jdbcTemplate;
        this.newsImageClient = newsImageClient;
        this.newsArticleText = newsArticleText;
    }

    public void normalizeStoredNewsArticles() {
        List<StoredNewsArticle> articles = jdbcTemplate.query(
            """
                SELECT id, title, origin_link, link, published_at
                FROM news_articles
                """,
            (rs, rowNum) -> new StoredNewsArticle(
                rs.getLong("id"),
                rs.getString("title"),
                rs.getString("origin_link"),
                rs.getString("link"),
                rs.getTimestamp("published_at") == null ? null : rs.getTimestamp("published_at").toInstant()
            )
        );

        for (StoredNewsArticle article : articles) {
            String canonicalUrl = newsArticleText.canonicalizeUrl(newsArticleText.firstText(article.originLink(), article.link()));
            String dedupeKey = newsArticleText.buildDedupeKey(canonicalUrl, article.title(), article.publishedAt());
            jdbcTemplate.update(
                """
                    UPDATE news_articles
                    SET dedupe_key = ?,
                        canonical_url = ?
                    WHERE id = ?
                    """,
                dedupeKey,
                canonicalUrl,
                article.id()
            );
        }
    }

    public void deleteDuplicateNewsArticles() {
        jdbcTemplate.update(
            """
                DELETE FROM news_articles
                WHERE dedupe_key IS NOT NULL
                  AND id NOT IN (
                      SELECT keep_id
                      FROM (
                          SELECT MAX(id) AS keep_id
                          FROM news_articles
                          WHERE dedupe_key IS NOT NULL
                          GROUP BY dedupe_key
                      ) keepers
                  )
                """
        );
    }

    public void hydrateMissingLatestImages() {
        List<StoredNewsArticle> articles = jdbcTemplate.query(
            """
                SELECT id, title, origin_link, link, published_at
                FROM news_articles
                WHERE image_url IS NULL
                ORDER BY published_at DESC, id DESC
                LIMIT 20
                """,
            (rs, rowNum) -> new StoredNewsArticle(
                rs.getLong("id"),
                rs.getString("title"),
                rs.getString("origin_link"),
                rs.getString("link"),
                rs.getTimestamp("published_at") == null ? null : rs.getTimestamp("published_at").toInstant()
            )
        );

        for (StoredNewsArticle article : articles) {
            String imageUrl = newsImageClient.fetchRepresentativeImage(newsArticleText.firstText(article.originLink(), article.link()));
            if (StringUtils.hasText(imageUrl)) {
                jdbcTemplate.update(
                    """
                        UPDATE news_articles
                        SET image_url = ?
                        WHERE id = ?
                        """,
                    imageUrl,
                    article.id()
                );
            }
        }
    }

    private record StoredNewsArticle(long id, String title, String originLink, String link, Instant publishedAt) {
    }
}
