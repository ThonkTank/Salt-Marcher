package features.encounter.generation.service.search;

import features.encounter.generation.service.EncounterGenerator;
import features.encounter.generation.service.EncounterSearchMetrics;
import features.encounter.generation.service.EncounterScoring;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchExecutionDebugMetadata;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.generation.service.search.model.SearchStopReason;
import features.encounter.generation.service.search.model.StateEntry;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.EncounterCreatureSnapshotMapper;
import features.encounter.model.EncounterSlot;
import features.encounter.rules.EncounterMobSlotRules;
import features.partyanalysis.model.EncounterWeightClass;

import java.util.ArrayList;
import java.util.List;

/**
 * Builds final encounter results and diagnostics from search state.
 */
public final class EncounterResultAssembler {
    private EncounterResultAssembler() {
        throw new AssertionError("No instances");
    }

    public static List<EncounterSlot> toEncounterSlots(SearchState state) {
        List<EncounterSlot> slots = new ArrayList<>();
        for (StateEntry entry : state.entries()) {
            EncounterCreatureSnapshot snapshot = EncounterCreatureSnapshotMapper.toSnapshot(entry.entry().creature());
            for (int part : EncounterMobSlotRules.splitForMobSlots(entry.count())) {
                slots.add(new EncounterSlot(
                        snapshot,
                        part,
                        entry.entry().weightClass(),
                        entry.entry().primaryRole()));
            }
        }
        return slots;
    }

    public static EncounterGenerator.GenerationDiagnostics buildDiagnostics(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            SearchExecutionDebugMetadata debugMetadata) {
        WeightClassSummary weightClassSummary = summarizeWeightClasses(state);
        return new EncounterGenerator.GenerationDiagnostics(
                state.adjustedXp(),
                state.rawXp(),
                EncounterSearchMetrics.estimatedRounds(state, budgets.party().actionsPerRound(), budgets.heuristics()),
                state.enemyActionUnits(),
                state.enemyTurnSlots(),
                state.distinctStatBlocks(),
                state.totalCreatureCount(),
                weightClassSummary.bossCount(),
                weightClassSummary.regularCount(),
                weightClassSummary.minionCount(),
                state.complexActionCount(),
                relaxation.pacingRelaxed(),
                relaxation.allowRoleRepeat(),
                deriveSolutionQuality(debugMetadata),
                deriveStopCategory(debugMetadata),
                debugMetadata == null ? 0 : debugMetadata.candidatePoolSize(),
                debugMetadata == null ? 0 : debugMetadata.iterations(),
                debugMetadata == null ? 0 : debugMetadata.candidateEvaluations());
    }

    public static EncounterGenerator.GenerationResult buildNoSolutionResult() {
        return EncounterGenerator.GenerationResult.noSolution(
                EncounterGenerator.GenerationFailureReason.AUTO_CONFIG_NO_SOLUTION);
    }

    public static EncounterGenerator.GenerationResult buildSuccessResult(
            SearchTermination termination,
            EncounterBudgets budgets,
            int avgLevel,
            int partySize) {
        SearchState state = termination.bestState();
        RelaxationProfile relaxation = termination.relaxation();
        SearchExecutionDebugMetadata debugMetadata = termination.debugMetadata();
        List<EncounterSlot> slots = toEncounterSlots(state);
        Encounter encounter = new Encounter(
                slots,
                EncounterScoring.classifyDifficultyFromSlots(slots, avgLevel, partySize),
                avgLevel,
                partySize,
                budgets.upperAdjustedXp(),
                EncounterScoring.deriveShapeLabel(slots));
        return EncounterGenerator.GenerationResult.success(
                encounter,
                deriveSolutionQuality(debugMetadata),
                deriveSearchAdvisories(debugMetadata),
                buildDiagnostics(state, budgets, relaxation, debugMetadata));
    }

    public static EncounterGenerator.GenerationResult buildTimeoutOrFallback(
            SearchTermination termination,
            EncounterBudgets budgets,
            int avgLevel,
            int partySize) {
        if (termination == null || termination.bestState() == null) {
            return EncounterGenerator.GenerationResult.timeout();
        }
        return buildSuccessResult(termination, budgets, avgLevel, partySize);
    }

    private static List<EncounterGenerator.GenerationAdvisory> deriveSearchAdvisories(
            SearchExecutionDebugMetadata debugMetadata) {
        if (debugMetadata == null) {
            return List.of();
        }
        return switch (debugMetadata.stopReason()) {
            case WORK_BUDGET_EXHAUSTED, DEADLINE_EXHAUSTED, CANCELLED ->
                    List.of(EncounterGenerator.GenerationAdvisory.SEARCH_BUDGET_FALLBACK_USED);
            case EXACT_MATCH, SEARCH_SPACE_EXHAUSTED -> List.of();
        };
    }

    private static EncounterGenerator.GenerationSolutionQuality deriveSolutionQuality(
            SearchExecutionDebugMetadata debugMetadata) {
        return debugMetadata != null && debugMetadata.stopReason() == SearchStopReason.EXACT_MATCH
                ? EncounterGenerator.GenerationSolutionQuality.EXACT
                : EncounterGenerator.GenerationSolutionQuality.FALLBACK;
    }

    private static EncounterGenerator.GenerationStopCategory deriveStopCategory(
            SearchExecutionDebugMetadata debugMetadata) {
        if (debugMetadata == null) {
            return EncounterGenerator.GenerationStopCategory.SEARCH_EXHAUSTED;
        }
        return switch (debugMetadata.stopReason()) {
            case EXACT_MATCH -> EncounterGenerator.GenerationStopCategory.COMPLETED;
            case SEARCH_SPACE_EXHAUSTED -> EncounterGenerator.GenerationStopCategory.SEARCH_EXHAUSTED;
            case WORK_BUDGET_EXHAUSTED -> EncounterGenerator.GenerationStopCategory.WORK_BUDGET;
            case DEADLINE_EXHAUSTED -> EncounterGenerator.GenerationStopCategory.DEADLINE;
            case CANCELLED -> EncounterGenerator.GenerationStopCategory.CANCELLED;
        };
    }

    private static WeightClassSummary summarizeWeightClasses(SearchState state) {
        int bossCount = 0;
        int regularCount = 0;
        int minionCount = 0;
        for (StateEntry entry : state.entries()) {
            EncounterWeightClass weightClass = entry.entry().weightClass();
            int count = entry.count();
            switch (weightClass) {
                case BOSS -> bossCount += count;
                case REGULAR -> regularCount += count;
                case MINION -> minionCount += count;
            }
        }
        return new WeightClassSummary(bossCount, regularCount, minionCount);
    }

    private record WeightClassSummary(int bossCount, int regularCount, int minionCount) {}
}
