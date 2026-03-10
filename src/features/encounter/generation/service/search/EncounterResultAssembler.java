package features.encounter.generation.service.search;

import features.encounter.generation.service.EncounterGenerator;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.generation.service.search.model.StateEntry;
import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.EncounterCreatureSnapshotMapper;
import features.encounter.model.EncounterSlot;
import features.encounter.rules.EncounterMobSlotRules;

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
            RelaxationProfile relaxation) {
        return new EncounterGenerator.GenerationDiagnostics(
                state.adjustedXp(),
                state.rawXp(),
                state.estimatedRounds(budgets.party().actionsPerRound()),
                state.enemyActionUnits(),
                state.enemyTurnSlots(),
                state.distinctStatBlocks(),
                state.gmComplexityLoad(),
                relaxation.pacingRelaxed(),
                relaxation.complexityRelaxed(),
                relaxation.allowRoleRepeat());
    }

    public static EncounterGenerator.GenerationResult buildNoSolutionResult() {
        return EncounterGenerator.GenerationResult.noSolution(
                EncounterGenerator.GenerationFailureReason.AUTO_CONFIG_NO_SOLUTION);
    }
}
