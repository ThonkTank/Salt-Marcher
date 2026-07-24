package features.sessionplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.encounter.api.GeneratedEncounterDifficulty;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterSource;
import features.encounter.api.PreparedEncounterBatch;
import features.encounter.api.PreparedEncounterCreature;
import features.encounter.api.PreparedEncounterRoster;
import features.sessiongeneration.api.GenerationDraft;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRunId;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import features.sessionplanner.domain.session.SessionTreasure;
import java.math.BigDecimal;
import java.util.List;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;

final class PreparedSessionDraftTest {

    private static final String IDENTITY_A = "v1:" + "a".repeat(64);
    private static final String IDENTITY_B = "v1:" + "b".repeat(64);
    private static final String DRAFT_FINGERPRINT = "v1:" + "c".repeat(64);

    @Test
    void deterministicReplayIsStableAndEveryOwnedIdentityChangeIsVisible() {
        GenerationDraft generation = new GenerationDraft(validResult(), DRAFT_FINGERPRINT);
        SessionPreparationFingerprint sourceA = source(IDENTITY_A);
        PreparedSessionDraft first = PreparedSessionDraft.assemble(sourceA, generation, batch(IDENTITY_A));
        PreparedSessionDraft replay = PreparedSessionDraft.assemble(sourceA, generation, batch(IDENTITY_A));
        PreparedSessionDraft changed = PreparedSessionDraft.assemble(
                source(IDENTITY_B), generation, batch(IDENTITY_B));

        assertEquals(first, replay);
        assertEquals(first.preparedContentFingerprint(), replay.preparedContentFingerprint());
        assertNotEquals(first.preparedContentFingerprint(), changed.preparedContentFingerprint());

        String persistence = persistenceFingerprint(101L);
        assertEquals(persistence, persistenceFingerprint(101L));
        assertNotEquals(persistence, persistenceFingerprint(202L));
    }

    @Test
    void canonicalLoosePackingIsAccepted() {
        PreparedSessionDraft prepared = PreparedSessionDraft.assemble(
                source(IDENTITY_A),
                new GenerationDraft(validResult(), DRAFT_FINGERPRINT),
                batch(IDENTITY_A));

        assertEquals(1, prepared.preparedTreasures().size());
        assertEquals(1L, prepared.preparedTreasures().getFirst().sceneId());
        assertEquals(1L, prepared.preparedTreasures().getFirst().treasureId());
    }

    @Test
    void malformedTargetBlockRewardAndLoosePackingFailClosed() {
        assertMalformed(result(100L, 101L, GenerationResult.EncounterRole.STANDARD, 1,
                "none", 0, "none"));
        assertMalformed(result(100L, 100L, null, 1,
                "none", 0, "none"));
        assertMalformed(result(100L, 100L, GenerationResult.EncounterRole.STANDARD, 2,
                "none", 0, "none"));
        assertMalformed(result(100L, 100L, GenerationResult.EncounterRole.STANDARD, 1,
                "none", 1, "none"));
    }

    private static void assertMalformed(GenerationResult result) {
        assertThrows(IllegalArgumentException.class, () -> PreparedSessionDraft.assemble(
                source(IDENTITY_A), new GenerationDraft(result, DRAFT_FINGERPRINT), batch(IDENTITY_A)));
    }

    private static SessionPreparationFingerprint source(String identity) {
        SessionPlan session = SessionPlan.seeded(7L, List.of(1L), EncounterDays.one());
        return new SessionPreparationFingerprint(
                identity,
                7L,
                SessionRevision.initial(),
                session,
                List.of(new SessionPreparationFingerprint.Participant(1L, 4)),
                BigDecimal.ONE,
                OptionalInt.of(1),
                41L);
    }

    private static PreparedEncounterBatch batch(String identity) {
        PreparedEncounterCreature creature = new PreparedEncounterCreature(101L, 1, "Wolf");
        GeneratedEncounterPlanSummary summary = new GeneratedEncounterPlanSummary(
                0L, "Generated 1", List.of(creature), 1, 100L, 100L,
                GeneratedEncounterDifficulty.MEDIUM, "1x Wolf");
        return new PreparedEncounterBatch(
                new GeneratedEncounterSource("engine", identity, "run"),
                "batch-fingerprint",
                List.of(new PreparedEncounterRoster(
                        1, "Generated 1", "intent-fingerprint", "roster-fingerprint",
                        List.of(creature), summary)));
    }

    private static GenerationResult validResult() {
        return result(100L, 100L, GenerationResult.EncounterRole.STANDARD, 1,
                "none", 0, "none");
    }

    private static GenerationResult result(
            long declaredTarget,
            long encounterTarget,
            GenerationResult.EncounterRole role,
            int rewardAnchor,
            String containerType,
            int containerCount,
            String containerId
    ) {
        return new GenerationResult(
                new GenerationRunId("run"), "engine", "catalog", "hash", 41L,
                List.of(new GenerationResult.PartyLevel(4, 1)),
                new GenerationResult.SessionSummary(
                        1, BigDecimal.ONE, 1, 1_000L, declaredTarget, BigDecimal.valueOf(4L),
                        100L, 0L, 1, 0, 0, 1),
                List.of(new GenerationResult.EncounterTarget(1, declaredTarget)),
                List.of(new GenerationResult.Encounter(
                        1, encounterTarget, 100L, GenerationResult.Difficulty.MEDIUM,
                        "candidate", "Wolf", 1, BigDecimal.ONE, 1, BigDecimal.ZERO,
                        List.of(new GenerationResult.EncounterBlock(
                                "block", role, 1, "1/2", 100L, 1)))),
                List.of(new GenerationResult.Treasure(
                        1, GenerationResult.StockClass.NORMAL, GenerationResult.RewardChannel.ENCOUNTER,
                        rewardAnchor, "Wolf cache", "none", 100L, 1, 0)),
                List.of(new GenerationResult.LootItem(
                        1, 1, GenerationResult.LootRole.USEFUL, "wolf-cache", "Wolf cache",
                        1L, 100L, 100L, BigDecimal.ONE, "none", "", false)),
                List.of(new GenerationResult.Packing(
                        1, 1, containerType, containerCount, containerId, true)),
                new GenerationResult.RewardSummary(100L, 0L, 0),
                "Generated output",
                List.of(new GenerationResult.Audit(
                        "final-output", GenerationResult.AuditStatus.PASS, "ok")));
    }

    private static String persistenceFingerprint(long planId) {
        return PreparedSessionPersistenceFingerprint.compute(
                7L,
                SessionRevision.initial(),
                IDENTITY_A,
                List.of(new PreparedSessionPersistenceFingerprint.Scene(
                        1L, 1, "100", "Scene", "", 0L)),
                List.of(),
                1L,
                List.of(),
                List.of(new SessionTreasure(
                        1L, 1L, "Reward", "", "", "", "", "", 0L, 0, 0, List.of(), List.of())),
                "run",
                List.of(new PreparedSessionPersistenceFingerprint.EncounterPlanMapping(1, planId)));
    }
}
