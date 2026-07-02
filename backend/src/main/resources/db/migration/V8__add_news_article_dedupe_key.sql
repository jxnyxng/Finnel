ALTER TABLE news_articles
    ADD COLUMN dedupe_key CHAR(64) NULL AFTER article_key,
    ADD COLUMN canonical_url VARCHAR(700) NULL AFTER link,
    ADD KEY idx_news_articles_dedupe_key (dedupe_key);
