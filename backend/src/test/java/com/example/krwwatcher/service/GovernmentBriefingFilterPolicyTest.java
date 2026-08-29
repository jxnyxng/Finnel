package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.krwwatcher.external.PolicyBriefingClient;
import org.junit.jupiter.api.Test;

class GovernmentBriefingFilterPolicyTest {

    private final GovernmentBriefingFilterPolicy policy = new GovernmentBriefingFilterPolicy();

    @Test
    void exposesRelevantCategoryCodesInRuleOrder() {
        assertThat(policy.relevantCategoryCodes())
            .containsExactly("monetary", "fiscal", "fx", "trade", "inflation");
    }

    @Test
    void classifiesRelevantPayloadByHighestKeywordScore() {
        PolicyBriefingClient.PolicyBriefingPayload payload = payload(
            "외환시장 환율 안정 방안",
            "원화 달러 환율 점검",
            "환율 외환 원화 달러 금융시장 ".repeat(20)
        );

        GovernmentBriefingFilterPolicy.RelevanceResult relevance = policy.relevance(payload);

        assertThat(relevance.categoryCode()).isEqualTo("fx");
        assertThat(relevance.score()).isGreaterThanOrEqualTo(4);
        assertThat(policy.isRelevant(payload)).isTrue();
    }

    @Test
    void rejectsPayloadWhenBodyIsTooShortEvenIfKeywordsMatch() {
        PolicyBriefingClient.PolicyBriefingPayload payload = payload(
            "외환시장 환율 안정 방안",
            "원화 달러 환율 점검",
            "환율"
        );

        assertThat(policy.isLowQualityBriefing(payload)).isTrue();
        assertThat(policy.isRelevant(payload)).isFalse();
    }

    private PolicyBriefingClient.PolicyBriefingPayload payload(String title, String subtitle, String body) {
        return new PolicyBriefingClient.PolicyBriefingPayload(
            title,
            subtitle,
            body,
            "기획재정부",
            null,
            null,
            null,
            null,
            "https://briefing.example.com/a",
            "KOG License Type 1"
        );
    }
}
