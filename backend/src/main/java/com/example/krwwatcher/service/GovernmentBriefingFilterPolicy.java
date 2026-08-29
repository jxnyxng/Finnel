package com.example.krwwatcher.service;

import java.util.List;
import java.util.Locale;

import com.example.krwwatcher.external.PolicyBriefingClient;
import org.springframework.util.StringUtils;

// Classifies policy briefing relevance and exposes category filter rules.
class GovernmentBriefingFilterPolicy {

    private static final int MIN_RELEVANCE_SCORE = 4;
    private static final int MIN_BODY_LENGTH = 300;
    private static final List<BriefingCategoryRule> CATEGORY_RULES = List.of(
        new BriefingCategoryRule("monetary", "통화정책", List.of("기준금리", "금리", "통화정책", "한국은행", "금융통화위원회", "금통위", "유동성", "통화량", "M2")),
        new BriefingCategoryRule("fiscal", "재정정책", List.of("재정", "국가채무", "국채", "예산", "세수", "기획재정부", "관리재정수지", "재정수지", "정책금융")),
        new BriefingCategoryRule("fx", "외환·금융시장", List.of("환율", "외환", "원화", "달러", "자본시장", "금융시장", "외국인", "채권", "주식시장")),
        new BriefingCategoryRule("trade", "무역·수급", List.of("수출", "수입", "무역수지", "경상수지", "관세", "통상", "공급망", "원자재")),
        new BriefingCategoryRule("inflation", "물가·민생", List.of("물가", "소비자물가", "생산자물가", "유가", "에너지", "인플레이션"))
    );
    private static final List<String> RELEVANT_CATEGORY_CODES = CATEGORY_RULES.stream()
        .map(BriefingCategoryRule::code)
        .toList();

    List<BriefingCategoryRule> categoryRules() {
        return CATEGORY_RULES;
    }

    List<String> relevantCategoryCodes() {
        return RELEVANT_CATEGORY_CODES;
    }

    int minBodyLength() {
        return MIN_BODY_LENGTH;
    }

    boolean isRelevant(PolicyBriefingClient.PolicyBriefingPayload payload) {
        return !isLowQualityBriefing(payload) && relevance(payload).score() >= MIN_RELEVANCE_SCORE;
    }

    boolean isLowQualityBriefing(PolicyBriefingClient.PolicyBriefingPayload payload) {
        String body = payload.body();
        return !StringUtils.hasText(body)
            || body.length() < MIN_BODY_LENGTH;
    }

    RelevanceResult relevance(PolicyBriefingClient.PolicyBriefingPayload payload) {
        String text = String.join(" ",
            nullToEmpty(payload.title()),
            nullToEmpty(payload.subtitle()),
            nullToEmpty(payload.body()),
            nullToEmpty(payload.ministry())
        ).toLowerCase(Locale.ROOT);
        int bestScore = 0;
        String bestCategory = null;
        for (BriefingCategoryRule rule : CATEGORY_RULES) {
            int score = 0;
            for (String keyword : rule.keywords()) {
                String normalizedKeyword = keyword.toLowerCase(Locale.ROOT);
                if (text.contains(normalizedKeyword)) {
                    score += keyword.length() >= 4 ? 3 : 2;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestCategory = rule.code();
            }
        }

        return new RelevanceResult(bestScore, bestCategory == null ? "policy" : bestCategory);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    record BriefingCategoryRule(String code, String label, List<String> keywords) {
    }

    record RelevanceResult(int score, String categoryCode) {
    }
}
