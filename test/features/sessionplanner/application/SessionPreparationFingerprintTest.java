package features.sessionplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import features.encounter.application.EncounterApplicationServiceFakes;
import features.encounter.api.EncounterPlanBudgetModel;
import features.encounter.api.EncounterPlanBudgetResult;
import features.encounter.api.EncounterPlanBudgetStatus;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.party.PartyServiceAssembly;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import java.math.BigDecimal;
import java.util.List;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;

final class SessionPreparationFingerprintTest {

    @Test
    void captureIsStableCanonicalAndSensitiveToEveryOwnedInputClass() {
        SessionPlannerForeignFacts levelFacts = facts(5);
        SessionPlan base = session(7L, SessionRevision.initial(), List.of(1L, 2L), "1");
        String identity = capture(base, levelFacts, OptionalInt.of(2), 41L);

        assertEquals(identity, capture(base, levelFacts, OptionalInt.of(2), 41L));
        assertEquals(identity, capture(
                session(7L, SessionRevision.initial(), List.of(2L, 1L), "1"),
                levelFacts,
                OptionalInt.of(2),
                41L));

        assertNotEquals(identity, capture(
                session(8L, SessionRevision.initial(), List.of(1L, 2L), "1"),
                levelFacts, OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(
                session(7L, new SessionRevision(2L), List.of(1L, 2L), "1"),
                levelFacts, OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(
                session(7L, SessionRevision.initial(), List.of(1L, 3L), "1"),
                levelFacts, OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(
                base, facts(6), OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(
                session(7L, SessionRevision.initial(), List.of(1L, 2L), "0.5"),
                levelFacts, OptionalInt.of(2), 41L));
        assertNotEquals(identity, capture(base, levelFacts, OptionalInt.empty(), 41L));
        assertNotEquals(identity, capture(base, levelFacts, OptionalInt.of(3), 41L));
        assertNotEquals(identity, capture(base, levelFacts, OptionalInt.of(2), 42L));
    }

    private static String capture(
            SessionPlan session,
            SessionPlannerForeignFacts facts,
            OptionalInt encounterCount,
            long seed
    ) {
        return SessionPreparationFingerprint.capture(session, facts, encounterCount, seed)
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
                sessionId,
                revision,
                "Fingerprint fixture",
                participants,
                new EncounterDays(new BigDecimal(fraction)),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                0L,
                "",
                1L,
                1L);
    }

    private static SessionPlannerForeignFacts facts(int secondLevel) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new InMemoryPartyRepository());
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("One", "Player", 4, 10, 10), MembershipState.ACTIVE));
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Two", "Player", secondLevel, 10, 10), MembershipState.ACTIVE));
        party.application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Three", "Player", 5, 10, 10), MembershipState.ACTIVE));
        SavedEncounterPlanListResult empty = new SavedEncounterPlanListResult(
                SavedEncounterPlanStatus.SUCCESS, List.of(), "");
        SavedEncounterPlanListModel savedPlans = new SavedEncounterPlanListModel(
                () -> empty,
                ignored -> () -> { },
                listener -> {
                    listener.accept(empty);
                    return () -> { };
                });
        EncounterPlanBudgetModel budget = new EncounterPlanBudgetModel(
                () -> new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.NOT_FOUND, null, ""),
                ignored -> () -> { });
        return new SessionPlannerForeignFacts(
                party.application(),
                party.activeParty(),
                party.adventuringDayCalculation(),
                EncounterApplicationServiceFakes.noOp(),
                savedPlans,
                budget,
                null);
    }

    private static final class InMemoryPartyRepository implements PartyRosterRepository {
        private PartyRoster roster = new PartyRoster(1L, List.of());

        @Override
        public PartyRoster load() {
            return roster;
        }

        @Override
        public void save(PartyRoster nextRoster) {
            roster = nextRoster;
        }
    }
}
