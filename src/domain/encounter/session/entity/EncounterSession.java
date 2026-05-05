package src.domain.encounter.session.entity;

import java.util.List;

public final class EncounterSession {

    private final EncounterSessionState state = new EncounterSessionState();

    public EncounterSessionState state() {
        return state;
    }

    public EncounterSessionViewState.SnapshotData snapshot() {
        return new EncounterSessionViewState.SnapshotData(
                state.context().mode(),
                builderState(),
                state.combat().initiativeState(),
                state.combat().combatState(),
                state.combat().resultState(),
                state.context().status(),
                missingCombatPartyMembers());
    }

    private EncounterSessionViewState.BuilderStateData builderState() {
        int adjustedXp = state.builder().generatedAdjustedXp() > 0
                ? state.builder().generatedAdjustedXp()
                : state.builder().roster().stream().mapToInt(EncounterSessionViewState.EncounterCreatureData::totalXp).sum();
        EncounterSessionRuntimeData.BudgetData budget = state.context().budget().orElse(null);
        EncounterSessionViewState.DifficultySummaryData difficulty = budget == null
                ? new EncounterSessionViewState.DifficultySummaryData(
                        0,
                        0,
                        0,
                        0,
                        adjustedXp,
                        state.builder().roster().isEmpty() ? "" : "Keine Party")
                : new EncounterSessionViewState.DifficultySummaryData(
                        budget.easyXp(),
                        budget.mediumXp(),
                        budget.hardXp(),
                        budget.deadlyXp(),
                        adjustedXp,
                        state.builder().generatedDifficulty().isBlank()
                                ? evaluateDifficulty(adjustedXp, budget)
                                : state.builder().generatedDifficulty());
        return new EncounterSessionViewState.BuilderStateData(
                List.copyOf(state.context().activeParty()),
                List.copyOf(state.builder().roster()),
                titleLabel(),
                difficulty,
                state.builder().builderInputs(),
                List.copyOf(state.context().savedPlans()),
                !state.builder().roster().isEmpty() && !state.context().activeParty().isEmpty(),
                state.builder().generatedAlternatives().size() > 1,
                state.builder().generatedAlternatives().size() > 1,
                !state.builder().roster().isEmpty(),
                state.builder().generationHistoryPresent() || !state.builder().generatedAlternatives().isEmpty(),
                state.builder().pendingUndo());
    }

    private List<EncounterSessionViewState.PartyMemberData> missingCombatPartyMembers() {
        List<String> activePcIds = state.combat().combatState().cards().stream()
                .filter(EncounterSessionViewState.CombatCardData::playerCharacter)
                .map(EncounterSessionViewState.CombatCardData::id)
                .toList();
        return state.context().activeParty().stream()
                .filter(member -> !activePcIds.contains(member.id()))
                .toList();
    }

    private String titleLabel() {
        if (state.builder().generatedTitle().isBlank()) {
            return state.builder().roster().isEmpty() ? "" : "Manuelles Encounter";
        }
        if (state.builder().generatedAlternatives().size() <= 1) {
            return state.builder().generatedTitle();
        }
        return state.builder().generatedTitle()
                + " ("
                + (state.builder().selectedAlternativeIndex() + 1)
                + "/"
                + state.builder().generatedAlternatives().size()
                + ")";
    }

    private static String evaluateDifficulty(int adjustedXp, EncounterSessionRuntimeData.BudgetData budget) {
        if (adjustedXp >= budget.deadlyXp()) {
            return "Deadly";
        }
        if (adjustedXp >= budget.hardXp()) {
            return "Hard";
        }
        if (adjustedXp >= budget.mediumXp()) {
            return "Medium";
        }
        return adjustedXp <= 0 ? "" : "Easy";
    }
}
