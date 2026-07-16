package src.domain.sessionplanner;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import src.data.sessionplanner.mapper.SessionPlanMapper;
import src.domain.sessionplanner.model.session.EncounterDays;
import src.domain.sessionplanner.model.session.GeneratedSessionPlan;
import src.domain.sessionplanner.model.session.GeneratedSessionPlan.GeneratedLootReference;
import src.domain.sessionplanner.model.session.GeneratedSessionPlan.GeneratedScene;
import src.domain.sessionplanner.model.session.SessionPlan;

class GeneratedSessionPlanReplacementTest {

    @Test
    void replacesTimelineButPreservesSessionIdentityAndParticipants() {
        SessionPlan existing = SessionPlan.seeded(7L, List.of(11L, 12L), new EncounterDays(new BigDecimal("0.6")))
                .addScene()
                .addLootPlaceholder(1L);
        GeneratedSessionPlan generated = new GeneratedSessionPlan(List.of(
                new GeneratedScene(0L, BigDecimal.ZERO, "Quest Reward", List.of(
                        new GeneratedLootReference(9L, 1L, "Quest loot"))),
                new GeneratedScene(41L, new BigDecimal("100"), "Encounter 1 · DEADLY", List.of(
                        new GeneratedLootReference(9L, 2L, "Encounter loot")))));

        SessionPlan replaced = existing.replaceWithGeneration(generated);

        assertEquals(7L, replaced.sessionId());
        assertEquals(existing.displayName(), replaced.displayName());
        assertEquals(List.of(11L, 12L), replaced.participantRefs());
        assertEquals(new BigDecimal("0.6"), replaced.encounterDays().value());
        assertEquals(2, replaced.encounters().size());
        assertEquals(41L, replaced.encounters().get(1).encounterPlanId());
        assertEquals(2, replaced.lootPlaceholders().size());
        assertTrue(replaced.lootPlaceholders().stream().allMatch(loot -> loot.generationId() == 9L));
        assertTrue(replaced.restPlacements().isEmpty());
        assertEquals(replaced.encounters().get(1).encounterId(), replaced.selectedEncounterId());

        SessionPlan persistedRoundTrip = SessionPlanMapper.toDomain(SessionPlanMapper.toSnapshot(replaced));
        assertEquals(replaced.lootPlaceholders(), persistedRoundTrip.lootPlaceholders());
    }
}
