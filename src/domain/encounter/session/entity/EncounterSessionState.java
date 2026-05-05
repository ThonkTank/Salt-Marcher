package src.domain.encounter.session.entity;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.OptionalLong;
import src.domain.encounter.generation.value.EncounterGenerationInputs;

public final class EncounterSessionState {

    private static final String DEFAULT_STATUS = "Encounter bereit.";
    private static final int FIRST_COMBAT_ROUND = 1;

    private final ContextState context = new ContextState();
    private final BuilderState builder = new BuilderState();
    private final CombatState combat = new CombatState();

    public ContextState context() {
        return context;
    }

    public BuilderState builder() {
        return builder;
    }

    public CombatState combat() {
        return combat;
    }

    public static final class ContextState {
        private final List<EncounterSessionViewState.PartyMemberData> activeParty = new ArrayList<>();
        private final List<EncounterSessionRuntimeData.SavedPlanSummaryData> savedPlans = new ArrayList<>();
        private EncounterSessionViewState.Mode mode = EncounterSessionViewState.Mode.BUILDER;
        private Optional<EncounterSessionRuntimeData.BudgetData> budget = Optional.empty();
        private String status = DEFAULT_STATUS;

        public List<EncounterSessionViewState.PartyMemberData> activeParty() {
            return activeParty;
        }

        public void replaceActiveParty(List<EncounterSessionViewState.PartyMemberData> nextParty) {
            activeParty.clear();
            if (nextParty != null) {
                activeParty.addAll(nextParty);
            }
        }

        public List<EncounterSessionRuntimeData.SavedPlanSummaryData> savedPlans() {
            return savedPlans;
        }

        public void clearSavedPlans() {
            savedPlans.clear();
        }

        public Optional<EncounterSessionRuntimeData.BudgetData> budget() {
            return budget;
        }

        public void setBudget(Optional<EncounterSessionRuntimeData.BudgetData> nextBudget) {
            budget = nextBudget == null ? Optional.empty() : nextBudget;
        }

        public EncounterSessionViewState.Mode mode() {
            return mode;
        }

        public void setMode(EncounterSessionViewState.Mode nextMode) {
            mode = nextMode == null ? EncounterSessionViewState.Mode.BUILDER : nextMode;
        }

        public String status() {
            return status;
        }

        public void setStatus(String nextStatus) {
            status = nextStatus == null ? "" : nextStatus;
        }
    }

    public static final class BuilderState {
        private final List<EncounterSessionViewState.EncounterCreatureData> roster = new ArrayList<>();
        private final List<EncounterSessionRuntimeData.GeneratedEncounterData> generatedAlternatives = new ArrayList<>();
        private EncounterGenerationInputs builderInputs = EncounterGenerationInputs.empty();
        private int selectedAlternativeIndex;
        private int generatedAdjustedXp;
        private String generatedDifficulty = "";
        private String generatedTitle = "";
        private Optional<EncounterSessionViewState.RemovedRosterEntryData> pendingUndo = Optional.empty();
        private boolean generationHistoryPresent;
        private OptionalLong activeSavedPlanId = OptionalLong.empty();
        private long nextUndoToken;

        public List<EncounterSessionViewState.EncounterCreatureData> roster() {
            return roster;
        }

        public List<EncounterSessionRuntimeData.GeneratedEncounterData> generatedAlternatives() {
            return generatedAlternatives;
        }

        public EncounterGenerationInputs builderInputs() {
            return builderInputs;
        }

        public void setBuilderInputs(EncounterGenerationInputs nextInputs) {
            builderInputs = nextInputs == null ? EncounterGenerationInputs.empty() : nextInputs;
        }

        public int selectedAlternativeIndex() {
            return selectedAlternativeIndex;
        }

        public void setSelectedAlternativeIndex(int nextIndex) {
            selectedAlternativeIndex = Math.max(0, nextIndex);
        }

        public int generatedAdjustedXp() {
            return generatedAdjustedXp;
        }

        public void setGeneratedAdjustedXp(int nextAdjustedXp) {
            generatedAdjustedXp = Math.max(0, nextAdjustedXp);
        }

        public String generatedDifficulty() {
            return generatedDifficulty;
        }

        public void setGeneratedDifficulty(String nextDifficulty) {
            generatedDifficulty = nextDifficulty == null ? "" : nextDifficulty;
        }

        public String generatedTitle() {
            return generatedTitle;
        }

        public void setGeneratedTitle(String nextTitle) {
            generatedTitle = nextTitle == null ? "" : nextTitle;
        }

        public Optional<EncounterSessionViewState.RemovedRosterEntryData> pendingUndo() {
            return pendingUndo;
        }

        public void setPendingUndo(Optional<EncounterSessionViewState.RemovedRosterEntryData> nextPendingUndo) {
            pendingUndo = nextPendingUndo == null ? Optional.empty() : nextPendingUndo;
        }

        public boolean generationHistoryPresent() {
            return generationHistoryPresent;
        }

        public void setGenerationHistoryPresent(boolean nextPresent) {
            generationHistoryPresent = nextPresent;
        }

        public OptionalLong activeSavedPlanId() {
            return activeSavedPlanId;
        }

        public void setActiveSavedPlanId(OptionalLong nextPlanId) {
            activeSavedPlanId = nextPlanId == null ? OptionalLong.empty() : nextPlanId;
        }

        public long nextUndoToken() {
            nextUndoToken++;
            return nextUndoToken;
        }
    }

    public static final class CombatState {
        private final List<EncounterSessionViewState.InitiativeEntryData> pendingInitiativeRows = new ArrayList<>();
        private final CombatRuntime combatRuntime = new CombatRuntime();
        private EncounterSessionViewState.InitiativeStateData initiativeState = EncounterSessionViewState.InitiativeStateData.empty();
        private EncounterSessionViewState.CombatProjectionData combatState = EncounterSessionViewState.CombatProjectionData.empty();
        private EncounterSessionViewState.ResultStateData resultState = EncounterSessionViewState.ResultStateData.empty();
        private OptionalInt currentTurnIndex = OptionalInt.empty();
        private int round = FIRST_COMBAT_ROUND;

        public List<EncounterSessionViewState.InitiativeEntryData> pendingInitiativeRows() {
            return pendingInitiativeRows;
        }

        public CombatRuntime combatRuntime() {
            return combatRuntime;
        }

        public EncounterSessionViewState.InitiativeStateData initiativeState() {
            return initiativeState;
        }

        public void setInitiativeState(EncounterSessionViewState.InitiativeStateData nextInitiativeState) {
            initiativeState = nextInitiativeState == null
                    ? EncounterSessionViewState.InitiativeStateData.empty()
                    : nextInitiativeState;
        }

        public EncounterSessionViewState.CombatProjectionData combatState() {
            return combatState;
        }

        public void setCombatState(EncounterSessionViewState.CombatProjectionData nextCombatState) {
            combatState = nextCombatState == null
                    ? EncounterSessionViewState.CombatProjectionData.empty()
                    : nextCombatState;
        }

        public EncounterSessionViewState.ResultStateData resultState() {
            return resultState;
        }

        public void setResultState(EncounterSessionViewState.ResultStateData nextResultState) {
            resultState = nextResultState == null
                    ? EncounterSessionViewState.ResultStateData.empty()
                    : nextResultState;
        }

        public OptionalInt currentTurnIndex() {
            return currentTurnIndex;
        }

        public void setCurrentTurnIndex(OptionalInt nextTurnIndex) {
            currentTurnIndex = nextTurnIndex == null ? OptionalInt.empty() : nextTurnIndex;
        }

        public int round() {
            return round;
        }

        public void setRound(int nextRound) {
            round = Math.max(FIRST_COMBAT_ROUND, nextRound);
        }
    }
}
