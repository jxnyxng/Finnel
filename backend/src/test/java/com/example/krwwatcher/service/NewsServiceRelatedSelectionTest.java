package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import javax.sql.DataSource;

import com.example.krwwatcher.external.NaverNewsClient;
import com.example.krwwatcher.service.news.NewsArticleText;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class NewsServiceRelatedSelectionTest {

    private JdbcTemplate jdbcTemplate;
    private NewsService newsService;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(dataSource());
        jdbcTemplate.execute("""
            CREATE TABLE news_articles (
                id BIGINT NOT NULL AUTO_INCREMENT,
                article_key CHAR(64) NOT NULL,
                dedupe_key CHAR(64) NULL,
                category_code VARCHAR(50) NOT NULL,
                category_name VARCHAR(80) NOT NULL,
                query_text VARCHAR(120) NOT NULL,
                title VARCHAR(500) NOT NULL,
                description VARCHAR(1000) NULL,
                origin_link VARCHAR(700) NULL,
                link VARCHAR(700) NOT NULL,
                canonical_url VARCHAR(700) NULL,
                publisher VARCHAR(100) NULL,
                published_at TIMESTAMP NULL,
                ai_summary VARCHAR(2000) NULL,
                market_sentiment VARCHAR(50) NULL,
                image_url VARCHAR(700) NULL,
                fetched_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id)
            )
            """);
        NaverNewsClient naverNewsClient = mock(NaverNewsClient.class);
        when(naverNewsClient.isConfigured()).thenReturn(true);
        newsService = new NewsService(naverNewsClient, null, jdbcTemplate, null, new NewsArticleText());
    }

    @Test
    void relatedNewsBannerCollapsesSimilarArticlesAndKeepsLongestRepresentative() {
        Instant now = Instant.now();
        insertArticle(
            "short-appointment",
            "김민수 신임 외환정책국장 선임",
            "정부가 김민수 신임 외환정책국장을 선임했다.",
            "https://news.example.com/short",
            "https://img.example.com/person.jpg",
            now.minusSeconds(600)
        );
        insertArticle(
            "long-appointment",
            "김민수 신임 외환정책국장 선임...외환시장 안정 과제 주목",
            "정부가 김민수 신임 외환정책국장을 선임했다. 시장에서는 원달러 환율 변동성, 외환시장 안정 조치, 외환보유액 운용 방향과 관련한 향후 정책 메시지를 함께 주목하고 있다.",
            "https://news.example.com/long",
            null,
            now.minusSeconds(1_200)
        );
        insertArticle(
            "same-appointment-other-url",
            "김민수 외환정책국장 임명",
            "김민수 신임 국장 선임 소식이 전해졌다.",
            "https://another.example.com/appointment",
            "https://img.example.com/person2.jpg",
            now.minusSeconds(1_800)
        );
        insertArticle(
            "exchange-rate",
            "원달러 환율 장중 1390원대 등락",
            "원달러 환율이 연준 발언과 달러 강세 영향으로 장중 1390원대에서 움직였다.",
            "https://news.example.com/exchange",
            "https://img.example.com/exchange.jpg",
            now.minusSeconds(900)
        );

        NewsService.RelatedNewsResponse response = newsService.related("exchange", 10);

        List<String> titles = response.articles().stream().map(NewsService.NewsArticle::title).toList();
        assertThat(response.configured()).isTrue();
        assertThat(titles)
            .contains("김민수 신임 외환정책국장 선임...외환시장 안정 과제 주목")
            .contains("원달러 환율 장중 1390원대 등락");
        assertThat(titles)
            .doesNotContain("김민수 신임 외환정책국장 선임")
            .doesNotContain("김민수 외환정책국장 임명");
    }

    @Test
    void relatedNewsBannerFillsNineArticlesAfterCollapsingSimilarArticles() {
        Instant now = Instant.now();
        insertNineBannerArticles(now);

        NewsService.RelatedNewsResponse response = newsService.related("exchange", 9);

        assertThat(response.articles()).hasSize(9);
        assertThat(response.articles())
            .extracting(NewsService.NewsArticle::title)
            .contains("김민수 신임 외환정책국장 선임...외환시장 안정 과제 주목")
            .doesNotContain("김민수 신임 외환정책국장 선임", "김민수 외환정책국장 임명");
    }

    @Test
    void relatedNewsBannerKeepsSnapshotUntilThreeImportantFreshArticlesArrive() {
        Instant now = Instant.now();
        insertNineBannerArticles(now);
        List<String> initialTitles = newsService.related("exchange", 9)
            .articles()
            .stream()
            .map(NewsService.NewsArticle::title)
            .toList();

        insertArticle("new-1", "원달러 환율 급등에 외환시장 변동성 확대", "원달러 환율과 외환시장 변동성이 동시에 커지며 달러 수급과 원화 약세 압력이 주요 변수로 떠올랐다.", "https://news.example.com/new-1", "https://img.example.com/new-1.jpg", now.plusSeconds(60));
        insertArticle("new-2", "연준 긴축 경계에 달러 인덱스 다시 상승", "연준 긴축 경계와 달러 인덱스 상승이 원달러 환율, 원화 흐름, 외환시장 투자 심리에 영향을 줬다.", "https://news.example.com/new-2", "https://img.example.com/new-2.jpg", now.plusSeconds(120));

        List<String> unchangedTitles = newsService.related("exchange", 9)
            .articles()
            .stream()
            .map(NewsService.NewsArticle::title)
            .toList();
        assertThat(unchangedTitles).containsExactlyElementsOf(initialTitles);

        insertArticle("new-3", "외환당국 시장 안정 메시지에 환율 상단 주목", "외환당국의 시장 안정 메시지와 원달러 환율 상단, 달러 수급 변화가 외환시장 주요 뉴스로 부각됐다.", "https://news.example.com/new-3", "https://img.example.com/new-3.jpg", now.plusSeconds(180));

        List<String> updatedTitles = newsService.related("exchange", 9)
            .articles()
            .stream()
            .map(NewsService.NewsArticle::title)
            .toList();
        assertThat(updatedTitles).hasSize(9);
        assertThat(updatedTitles).isNotEqualTo(initialTitles);
        assertThat(updatedTitles)
            .contains("원달러 환율 급등에 외환시장 변동성 확대")
            .contains("연준 긴축 경계에 달러 인덱스 다시 상승")
            .contains("외환당국 시장 안정 메시지에 환율 상단 주목");
    }

    private void insertNineBannerArticles(Instant now) {
        insertArticle(
            "short-appointment",
            "김민수 신임 외환정책국장 선임",
            "정부가 김민수 신임 외환정책국장을 선임했다.",
            "https://news.example.com/short",
            "https://img.example.com/person.jpg",
            now.minusSeconds(600)
        );
        insertArticle(
            "long-appointment",
            "김민수 신임 외환정책국장 선임...외환시장 안정 과제 주목",
            "정부가 김민수 신임 외환정책국장을 선임했다. 시장에서는 원달러 환율 변동성, 외환시장 안정 조치, 외환보유액 운용 방향과 관련한 향후 정책 메시지를 함께 주목하고 있다.",
            "https://news.example.com/long",
            null,
            now.minusSeconds(1_200)
        );
        insertArticle(
            "same-appointment-other-url",
            "김민수 외환정책국장 임명",
            "김민수 신임 국장 선임 소식이 전해졌다.",
            "https://another.example.com/appointment",
            "https://img.example.com/person2.jpg",
            now.minusSeconds(1_800)
        );
        insertArticle("unique-1", "원달러 환율 장중 1390원대 등락", "연준 발언과 달러 강세 영향으로 원달러 환율이 움직였다.", "https://news.example.com/unique-1", null, now.minusSeconds(2_400));
        insertArticle("unique-2", "달러 인덱스 상승에 원화 약세 압력 확대", "달러 인덱스가 오르며 원화와 아시아 통화 약세 흐름이 나타났다.", "https://news.example.com/unique-2", null, now.minusSeconds(3_600));
        insertArticle("unique-3", "연준 위원 매파 발언에 외환시장 경계감", "연준 위원의 금리 발언 이후 외환시장 변동성 경계가 커졌다.", "https://news.example.com/unique-3", null, now.minusSeconds(7_200));
        insertArticle("unique-4", "한국은행 기준금리 동결 이후 환율 흐름 주목", "한국은행 금리 결정 이후 원화 수급과 외국인 자금 흐름이 주목된다.", "https://news.example.com/unique-4", null, now.minusSeconds(10_800));
        insertArticle("unique-5", "외환보유액 변화와 원화 안정성 점검", "외환보유액 지표가 원화 안정성과 대외 건전성 판단 자료로 쓰인다.", "https://news.example.com/unique-5", null, now.minusSeconds(86_400));
        insertArticle("unique-6", "미국 물가 지표 발표 앞두고 달러 수요 증가", "미국 물가 지표를 앞두고 달러 수요와 원달러 환율 방향성이 주목된다.", "https://news.example.com/unique-6", null, now.minusSeconds(172_800));
        insertArticle("unique-7", "경상수지 흑자에도 원화 반등 제한", "경상수지 개선에도 글로벌 달러 강세가 원화 반등을 제한했다.", "https://news.example.com/unique-7", null, now.minusSeconds(259_200));
        insertArticle("unique-8", "외환당국 구두개입 가능성에 시장 촉각", "외환당국의 시장 안정 메시지 가능성이 원달러 환율 상단을 제약했다.", "https://news.example.com/unique-8", null, now.minusSeconds(604_800));
    }

    private void insertArticle(String key, String title, String description, String link, String imageUrl, Instant publishedAt) {
        jdbcTemplate.update(
            """
                INSERT INTO news_articles (
                    article_key, category_code, category_name, query_text, title, description, link, published_at, image_url, fetched_at
                )
                VALUES (?, 'fx', '환율', '원달러 환율', ?, ?, ?, ?, ?, ?)
                """,
            key,
            title,
            description,
            link,
            publishedAt,
            imageUrl,
            Instant.now()
        );
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:news-related-selection-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_UPPER=false;NON_KEYWORDS=VALUE;DB_CLOSE_DELAY=-1");
        return dataSource;
    }
}
