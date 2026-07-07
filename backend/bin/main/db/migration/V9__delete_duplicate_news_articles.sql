DELETE n
FROM news_articles n
JOIN (
    SELECT duplicate_id
    FROM (
        SELECT n1.id AS duplicate_id
        FROM news_articles n1
        JOIN news_articles n2
          ON n1.id < n2.id
         AND n1.dedupe_key IS NOT NULL
         AND n1.dedupe_key = n2.dedupe_key
        UNION
        SELECT n1.id AS duplicate_id
        FROM news_articles n1
        JOIN news_articles n2
          ON n1.id < n2.id
         AND LOWER(TRIM(n1.title)) = LOWER(TRIM(n2.title))
         AND COALESCE(DATE(n1.published_at), DATE(n1.fetched_at)) = COALESCE(DATE(n2.published_at), DATE(n2.fetched_at))
    ) duplicate_rows
) duplicates ON duplicates.duplicate_id = n.id;
