package features.sessionplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import features.party.api.AdventuringDayPlanningSummary;
import features.party.api.PartyMemberSummary;
import features.party.api.PartyPlanningFactsResponse;
import features.party.api.ReadStatus;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;

final class SessionPreparationFingerprintTest {

    @Test
    void captureIsStableCanonicalAndSensitiveToEveryOwnedInputClass() {
        SessionPlan base = session(7L, SessionRevision.initial(), List.of(1L, 2L), "1");
        String identity = capture(base, 5, OptionalInt.of(2), 41L);

        assertEquals(identity, capture(base, 5, OptionalInt.of(2), 41L));
        assertEquals(identity, capture(
                session(7L, SessionRevision.initial(), List.of(2L, 1L), "1"),
                5, OptionalInt.of(2), 41L));

        assertNotEquals(identity, capture(
                session(8L, SessionRevision.initial(), List.of(1L, 2L), "1"),
                5, OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(
                session(7L, new SessionRevision(2L), List.of(1L, 2L), "1"),
                5, OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(
                session(7L, SessionRevision.initial(), List.of(1L, 3L), "1"),
                5, OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(base, 6, OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(
                session(7L, SessionRevision.initial(), List.of(1L, 2L), "0.5"),
                5, OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(base, 5, OptionalInt.empty(), 41L));
        assertNotEquals(identity, capture(base, 5, OptionalInt.of(3), 41L));
        assertNotEquals(identity, capture(base, 5, OptionalInt.of(2), 42L));
    }

    private static String capture(
            SessionPlan session,
            int secondLevel,
            OptionalInt encounterCount,
            long seed
    ) {
        return SessionPreparationFingerprint.capture(
                        session, facts(session.participantRefs(), secondLevel), encounterCount, seed)
                .orElseThrow()
                .identity();
    }

    private static SessionPlan session(
            long sessionId,
            SessionRevision revision,
            List<Long> participants,
            String fraction
    ) {
        return new SessionPlan(
                sessionId, revision, "Fingerprint fixture", participants,
                new EncounterDays(new BigDecimal(fraction)), List.of(), List.of(), List.of(),
                List.<features.sessionplanner.domain.session.SessionTreasure>of(),
                0L, "", 1L, 1L);
    }

    private static PartyPlanningFactsResponse facts(List<Long> requested, int secondLevel) {
        Map<Long, PartyMemberSummary> members = Map.of(
                1L, new PartyMemberSummary(1L, "One", 4),
                2L, new PartyMemberSummary(2L, "Two", secondLevel),
                3L, new PartyMemberSummary(3L, "Three", 5));
        return new PartyPlanningFactsResponse(
                ReadStatus.SUCCESS,
                List.copyOf(members.values()),
                requested.stream().map(id -> new PartyPlanningFactsResponse.ResolvedParticipant(
                        id, members.get(id))).toList(),
                AdventuringDayPlanningSummary.empty(),
                "");
    }
}
