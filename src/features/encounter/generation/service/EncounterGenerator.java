package features.encounter.generation.service;

import java.util.List;
import java.util.Map;

import features.encounter.combat.model.Combatant;
import features.creatures.model.Creature;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;
import features.encounter.rules.EncounterMobSlotRules;
import features.encounter.rules.EncounterRules;
import features.encounter.generation.service.search.EncounterSearchEngine;
import features.partyanalysis.model.CreatureRoleProfile;

/**
 * Facade for encounter generation and XP helpers.
 * Implementation lives in EncounterTuning, EncounterScoring, and
 * EncounterSearchEngine.
 */
public final class EncounterGenerator {
    private EncounterGenerator() {
        throw new AssertionError("No instances");
    }

    public static final int MAX_CREATURES_PER_SLOT = EncounterRules.MAX_CREATURES_PER_SLOT;
    public static final int MAX_TURNS_PER_ROUND = EncounterRules.MAX_TURNS_PER_ROUND;

    public enum GenerationStatus {
        SUCCESS,
        NO_SOLUTION,
        BLOCKED_BY_USER_INPUT,
        TIMEOUT
    }

    public enum GenerationFailureReason {
        TABLE_CANDIDATES_STORAGE_ERROR,
        AUTO_CONFIG_NO_SOLUTION,
        TIMEOUT
    }

    public enum GenerationAdvisory {
        PARTY_ROLE_FALLBACK_CACHE_REBUILDING,
        PARTY_ROLE_FALLBACK_STORAGE_UNAVAILABLE
    }

    public record GenerationDiagnostics(
            int adjustedXp,
            int rawXp,
            double estimatedRounds,
            double enemyActionUnitsPerRound,
            int enemyTurnSlots,
            int distinctStatBlocks,
            double totalGmComplexityLoad,
            boolean pacingRelaxed,
            boolean complexityRelaxed,
            boolean diversityRelaxed
    ) {}

    public record GenerationDataSnapshot(
            Map<Long, Integer> selectionWeights,
            Map<Long, CreatureRoleProfile> roleProfilesByCreatureId
    ) {
        public GenerationDataSnapshot {
            selectionWeights = selectionWeights == null ? Map.of() : Map.copyOf(selectionWeights);
            roleProfilesByCreatureId = roleProfilesByCreatureId == null ? Map.of() : Map.copyOf(roleProfilesByCreatureId);
        }

        public static GenerationDataSnapshot empty() {
            return new GenerationDataSnapshot(Map.of(), Map.of());
        }
    }

    public record GenerationResult(
            GenerationStatus status,
            Encounter encounter,
            GenerationFailureReason failureReason,
            GenerationAdvisory advisory,
            GenerationDiagnostics diagnostics
    ) {
        public static GenerationResult success(Encounter encounter) {
            return success(encounter, null, null);
        }

        public static GenerationResult success(Encounter encounter, GenerationAdvisory advisory) {
            return success(encounter, advisory, null);
        }

        public static GenerationResult success(
                Encounter encounter,
                GenerationAdvisory advisory,
                GenerationDiagnostics diagnostics) {
            return new GenerationResult(GenerationStatus.SUCCESS, encounter, null, advisory, diagnostics);
        }

        public static GenerationResult noSolution(GenerationFailureReason failureReason) {
            return new GenerationResult(GenerationStatus.NO_SOLUTION, null, failureReason, null, null);
        }

        public static GenerationResult blockedByUserInput(GenerationFailureReason failureReason) {
            return new GenerationResult(GenerationStatus.BLOCKED_BY_USER_INPUT, null, failureReason, null, null);
        }

        public static GenerationResult timeout() {
            return new GenerationResult(GenerationStatus.TIMEOUT, null, GenerationFailureReason.TIMEOUT, null, null);
        }
    }

    /**
     * Parameters for encounter generation.
     *
     * @param difficultyBand  difficulty band, {@code null} for Auto
     * @param amountValue     1.0..5.0, negative for Auto (few creatures -> many creatures)
     * @param balanceLevel    1..5, negative for Auto (ends -> middle XP preference)
     */
    public record EncounterRequest(
            int partySize,
            int avgLevel,
            List<String> creatureTypes,
            List<String> subtypes,
            List<String> biomes,
            EncounterDifficultyBand difficultyBand,
            double amountValue,
            int balanceLevel,
            GenerationDataSnapshot analysisSnapshot
    ) {
        public EncounterRequest {
            analysisSnapshot = analysisSnapshot == null ? GenerationDataSnapshot.empty() : analysisSnapshot;
        }
    }

    /**
     * Computes the XP ceiling for candidate pre-fetching.
     * Auto mode uses the global maximum (125% Deadly).
     */
    public static int computeXpCeiling(int avgLevel, EncounterDifficultyBand difficultyBand, int partySize) {
        return EncounterTuning.computeXpCeiling(avgLevel, difficultyBand, partySize);
    }

    /** UI helper: returns the adjusted XP range for the selected difficulty band. */
    public static EncounterTuning.DifficultyBandBudgetRange difficultyBandBudgetRange(
            int avgLevel,
            int partySize,
            EncounterDifficultyBand difficultyBand) {
        return EncounterTuning.difficultyBandBudgetRange(avgLevel, partySize, difficultyBand);
    }

    /** UI helper: minimum feasible monster initiative slots for the current party context. */
    public static int minMonsterSlotsForParty(int partySize) {
        return EncounterTuning.minMonsterSlotsForParty(partySize);
    }

    /** UI helper: maximum feasible monster initiative slots for the current party context. */
    public static int maxMonsterSlotsForParty(int partySize) {
        return EncounterTuning.maxMonsterSlotsForParty(partySize);
    }

    public static GenerationResult generateEncounter(
            EncounterRequest request,
            List<Creature> candidates
    ) {
        return generateEncounter(request, candidates, GenerationContext.defaultContext());
    }

    public static GenerationResult generateEncounter(
            EncounterRequest request,
            List<Creature> candidates,
            GenerationContext context
    ) {
        return EncounterSearchEngine.generateEncounter(request, candidates, context);
    }

    /**
     * Mob slot partitioning:
     * 1-3 creatures: individual slots (size 1)
     * 4-10 creatures: one slot
     * >10 creatures: split into multiple mob-sized slots (4..10)
     */
    public static List<Integer> splitForMobSlots(int count) {
        return EncounterMobSlotRules.splitForMobSlots(count);
    }

    public static int targetCreaturesForAmount(double amountValue, int partySize) {
        return EncounterTuning.targetCreaturesForAmount(amountValue, partySize);
    }

    /** Source: DMG p.83, encounter multipliers. */
    public static double multiplierForGroupSize(int groupSize) {
        return EncounterScoring.multiplierForGroupSize(groupSize);
    }

    public static int adjustedXp(List<EncounterSlot> slots) {
        return EncounterScoring.adjustedXp(slots);
    }

    /** Computes adjusted XP for a list of creatures with their counts (avoids EncounterSlot allocation). */
    public static int adjustedXpFromCounts(List<Creature> creatures, List<Integer> counts) {
        return EncounterScoring.adjustedXpFromCounts(creatures, counts);
    }

    /** Computes adjusted XP directly from alive monster combatants, avoiding intermediate maps. */
    public static int adjustedXpFromCombatants(List<Combatant> combatants) {
        return EncounterScoring.adjustedXpFromCombatants(combatants);
    }
}
