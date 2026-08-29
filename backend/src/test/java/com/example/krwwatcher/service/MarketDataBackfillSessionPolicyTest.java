package com.example.krwwatcher.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

class MarketDataBackfillSessionPolicyTest {

    private final MarketDataBackfillSessionPolicy policy = new MarketDataBackfillSessionPolicy();

    @Test
    void cooldownPreventsRetryUntilNextAllowedAt() {
        LocalDate sessionStartDate = LocalDate.of(2026, 7, 17);
        Instant nextAllowedAt = Instant.parse("2026-07-18T01:10:00Z");

        MarketDataBackfillSessionDecision decision = policy.decideBackfillSession(
            sessionStartDate,
            "USD/KRW:2026-07-17",
            attempt(sessionStartDate, 1, nextAllowedAt),
            LocalDateTime.of(2026, 7, 18, 5, 55),
            Instant.parse("2026-07-18T00:15:00Z"),
            3,
            false
        );

        assertThat(decision.canAttempt()).isFalse();
        assertThat(decision.status()).isEqualTo("SKIPPED_SESSION_COOLDOWN");
        assertThat(decision.noChangeCount()).isEqualTo(1);
        assertThat(decision.nextAllowedAt()).isEqualTo(nextAllowedAt);
        assertThat(decision.message()).isEqualTo("session retry cooldown active");
    }

    @Test
    void noChangeThresholdSuspendsScheduledRetryButBypassCanAttempt() {
        LocalDate sessionStartDate = LocalDate.of(2026, 7, 17);
        MarketDataUsdKrwBackfillAttempt latestAttempt = attempt(sessionStartDate, 3, Instant.parse("2026-07-18T00:09:00Z"));
        Instant now = Instant.parse("2026-07-18T02:10:00Z");

        MarketDataBackfillSessionDecision scheduledDecision = policy.decideBackfillSession(
            sessionStartDate,
            "USD/KRW:2026-07-17",
            latestAttempt,
            LocalDateTime.of(2026, 7, 18, 5, 55),
            now,
            3,
            false
        );
        MarketDataBackfillSessionDecision bypassDecision = policy.decideBackfillSession(
            sessionStartDate,
            "USD/KRW:2026-07-17",
            latestAttempt,
            LocalDateTime.of(2026, 7, 18, 5, 55),
            now,
            3,
            true
        );

        assertThat(scheduledDecision.canAttempt()).isFalse();
        assertThat(scheduledDecision.status()).isEqualTo("SKIPPED_SESSION_SUSPENDED");
        assertThat(scheduledDecision.message()).isEqualTo("no-change threshold reached");
        assertThat(bypassDecision.canAttempt()).isTrue();
        assertThat(bypassDecision.noChangeCount()).isEqualTo(3);
    }

    @Test
    void sessionIsIncompleteBeforeExpectedFinalFiveMinuteObservation() {
        LocalDate sessionStartDate = LocalDate.of(2026, 7, 17);

        assertThat(policy.needsBackfill(sessionStartDate, null)).isTrue();
        assertThat(policy.isSessionIncomplete(sessionStartDate, LocalDateTime.of(2026, 7, 18, 5, 54))).isTrue();
        assertThat(policy.isSessionIncomplete(sessionStartDate, LocalDateTime.of(2026, 7, 18, 5, 55))).isFalse();
    }

    @Test
    void formatsBackfillMessageWithoutChangingFields() {
        assertThat(policy.formatBackfillMessage("USD/KRW:2026-07-17", "NO_CHANGE", "no new observations returned"))
            .isEqualTo("backfillSession=USD/KRW:2026-07-17, backfillStatus=NO_CHANGE, backfillMessage=no new observations returned");
        assertThat(policy.formatBackfillMessage("USD/KRW:2026-07-17", "BACKFILLED", null))
            .isEqualTo("backfillSession=USD/KRW:2026-07-17, backfillStatus=BACKFILLED");
    }

    private MarketDataUsdKrwBackfillAttempt attempt(LocalDate sessionStartDate, int noChangeCount, Instant nextAllowedAt) {
        return new MarketDataUsdKrwBackfillAttempt(
            "USD/KRW:" + sessionStartDate,
            sessionStartDate,
            "NO_CHANGE",
            0,
            null,
            LocalDateTime.of(2026, 7, 18, 5, 55),
            noChangeCount,
            Instant.parse("2026-07-18T00:10:00Z"),
            nextAllowedAt,
            "no new observations returned"
        );
    }
}
