package features.encounter.generation.service.search;

import features.encounter.generation.service.EncounterGenerator;
import features.encounter.generation.service.EncounterSearchMetrics;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.generation.service.search.model.StateEntry;
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
            int candidatePoolSize,
            int iterations,
            int candidateEvaluations,
            int backtrackCount,
            int relaxationStage,
            boolean exactMatchFound,
            boolean searchBudgetExhausted) {
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
                candidatePoolSize,
                iterations,
                candidateEvaluations,
                backtrackCount,
                relaxationStage,
                exactMatchFound,
                searchBudgetExhausted);
    }

    public static EncounterGenerator.GenerationResult buildNoSolutionResult() {
        return EncounterGenerator.GenerationResult.noSolution(
                EncounterGenerator.GenerationFailureReason.AUTO_CONFIG_NO_SOLUTION);
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
