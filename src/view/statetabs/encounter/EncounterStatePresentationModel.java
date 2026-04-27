package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.EncounterSessionSnapshot.InitiativeState;
import src.domain.encounter.published.EncounterSessionSnapshot.PartyMember;
import src.domain.encounter.published.EncounterSessionSnapshot.RemovedRosterEntry;
import src.domain.encounter.published.EncounterSessionSnapshot.ResultState;
import src.domain.encounter.published.SavedEncounterPlanSummary;

public final class EncounterStatePresentationModel {

    public enum Mode {
        BUILDER,
        INITIATIVE,
        COMBAT,
        RESULTS
    }

    private final List<PartyMember> missingCombatPartyMembers = new ArrayList<>();
    private final ReadOnlyObjectWrapper<Mode> mode = new ReadOnlyObjectWrapper<>(Mode.BUILDER);
    private final ReadOnlyObjectWrapper<BuilderState> builderState =
            new ReadOnlyObjectWrapper<>(BuilderState.empty(BuilderSettings.defaultSettings()));
    private final ReadOnlyObjectWrapper<InitiativeState> initiativeState =
            new ReadOnlyObjectWrapper<>(InitiativeState.empty());
    private final ReadOnlyObjectWrapper<EncounterSessionSnapshot.CombatProjection> combatState =
            new ReadOnlyObjectWrapper<>(EncounterSessionSnapshot.CombatProjection.empty());
    private final ReadOnlyObjectWrapper<ResultState> resultState =
            new ReadOnlyObjectWrapper<>(ResultState.empty());
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("Encounter bereit.");

    EncounterStatePresentationModel() {
    }

    ReadOnlyObjectProperty<Mode> modeProperty() {
        return mode.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<BuilderState> builderStateProperty() {
        return builderState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<InitiativeState> initiativeStateProperty() {
        return initiativeState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<EncounterSessionSnapshot.CombatProjection> combatStateProperty() {
        return combatState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<ResultState> resultStateProperty() {
        return resultState.getReadOnlyProperty();
    }

    ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    List<PartyMember> missingCombatPartyMembers() {
        return List.copyOf(missingCombatPartyMembers);
    }

    ActionIntent refreshPartyContext() {
        return new ActionIntent(Action.REFRESH, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent generate() {
        return new ActionIntent(Action.GENERATE, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent saveCurrentPlan() {
        return new ActionIntent(Action.SAVE_CURRENT_PLAN, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent openSavedPlan(long planId) {
        return new ActionIntent(Action.OPEN_SAVED_PLAN, 0L, planId, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent clearGenerationHistory() {
        return new ActionIntent(Action.CLEAR_GENERATION_HISTORY, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent shiftGeneratedAlternative(int delta) {
        return new ActionIntent(Action.SHIFT_ALTERNATIVE, 0L, 0L, delta, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent addCreature(long creatureId) {
        return new ActionIntent(Action.ADD_CREATURE, creatureId, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent incrementCreature(long creatureId) {
        return new ActionIntent(Action.INCREMENT_CREATURE, creatureId, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent decrementCreature(long creatureId) {
        return new ActionIntent(Action.DECREMENT_CREATURE, creatureId, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent removeCreature(long creatureId) {
        return new ActionIntent(Action.REMOVE_CREATURE, creatureId, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent undoRemove(long token) {
        return new ActionIntent(Action.UNDO_REMOVE, 0L, 0L, 0, token, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent openInitiative() {
        return new ActionIntent(Action.OPEN_INITIATIVE, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent backToBuilder() {
        return new ActionIntent(Action.BACK_TO_BUILDER, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent confirmInitiative(List<InitiativeEntry> initiatives) {
        return new ActionIntent(
                Action.CONFIRM_INITIATIVE,
                0L,
                0L,
                0,
                0L,
                safeInitiativeEntries(initiatives).stream()
                        .map(input -> new EncounterSessionSnapshot.InitiativeInput(input.id(), input.initiative()))
                        .toList(),
                "",
                0,
                0L,
                0,
                false);
    }

    ActionIntent nextTurn() {
        return new ActionIntent(Action.ADVANCE_TURN, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent setInitiative(String combatantId, int initiative) {
        return new ActionIntent(Action.SET_INITIATIVE, 0L, 0L, 0, 0L, List.of(), combatantId, initiative, 0L, 0, false);
    }

    ActionIntent addPartyMemberToCombat(long partyMemberId, int initiative) {
        return new ActionIntent(Action.ADD_PARTY_MEMBER_TO_COMBAT, 0L, 0L, 0, 0L, List.of(), "", initiative, partyMemberId, 0, false);
    }

    ActionIntent endCombat() {
        return new ActionIntent(Action.END_COMBAT, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent awardXp() {
        return new ActionIntent(Action.AWARD_XP, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent returnToBuilderAfterResults() {
        return new ActionIntent(Action.RETURN_TO_BUILDER_AFTER_RESULTS, 0L, 0L, 0, 0L, List.of(), "", 0, 0L, 0, false);
    }

    ActionIntent mutateHp(String combatantId, int amount, boolean healing) {
        return new ActionIntent(Action.MUTATE_HP, 0L, 0L, 0, 0L, List.of(), combatantId, 0, 0L, amount, healing);
    }

    void apply(EncounterSessionSnapshot snapshot) {
        EncounterSessionSnapshot safeSnapshot = snapshot == null ? EncounterSessionSnapshot.empty("") : snapshot;
        mode.set(toMode(safeSnapshot.mode()));
        builderState.set(toBuilderState(safeSnapshot.builderState()));
        initiativeState.set(safeSnapshot.initiativeState());
        combatState.set(safeSnapshot.combatState());
        resultState.set(safeSnapshot.resultState());
        status.set(safeSnapshot.status());
        missingCombatPartyMembers.clear();
        missingCombatPartyMembers.addAll(safeSnapshot.missingCombatPartyMembers());
    }

    private static Mode toMode(EncounterSessionSnapshot.Mode source) {
        return switch (source == null ? EncounterSessionSnapshot.Mode.BUILDER : source) {
            case BUILDER -> Mode.BUILDER;
            case INITIATIVE -> Mode.INITIATIVE;
            case COMBAT -> Mode.COMBAT;
            case RESULTS -> Mode.RESULTS;
        };
    }

    private static BuilderState toBuilderState(EncounterSessionSnapshot.BuilderState source) {
        EncounterSessionSnapshot.BuilderState safeSource = source == null
                ? EncounterSessionSnapshot.BuilderState.empty()
                : source;
        return new BuilderState(
                safeSource.party(),
                safeSource.roster(),
                safeSource.templateLabel(),
                safeSource.difficulty(),
                safeSource.savedPlans(),
                toBuilderSettings(safeSource.builderInputs()),
                safeSource.canStartCombat(),
                safeSource.canPreviousAlternative(),
                safeSource.canNextAlternative(),
                safeSource.canSavePlan(),
                safeSource.canClearGenerationHistory(),
                safeSource.pendingUndo());
    }

    private static BuilderSettings toBuilderSettings(
            EncounterSessionSnapshot.BuilderInputs builderInputs
    ) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        return new BuilderSettings(
                difficultyLabel(safeInputs.targetDifficulty()),
                safeInputs.tuning().balanceLevel(),
                safeInputs.tuning().amountValue(),
                safeInputs.tuning().diversityLevel());
    }

    private static List<InitiativeEntry> safeInitiativeEntries(List<InitiativeEntry> initiatives) {
        return initiatives == null ? List.of() : List.copyOf(initiatives);
    }

    private static String difficultyLabel(
            src.domain.encounter.published.EncounterDifficultyBand difficulty
    ) {
        if (difficulty == null || difficulty.isAuto()) {
            return "Auto";
        }
        return difficulty.name();
    }

    public record BuilderSettings(
            String difficultyLabel,
            int balanceLevel,
            double amountValue,
            int diversityLevel
    ) {
        public static BuilderSettings defaultSettings() {
            return new BuilderSettings("Auto", -1, -1.0, -1);
        }
    }

    public record BuilderState(
            List<PartyMember> party,
            List<EncounterSessionSnapshot.EncounterCreature> roster,
            String templateLabel,
            EncounterSessionSnapshot.DifficultySummary difficulty,
            List<SavedEncounterPlanSummary> savedPlans,
            BuilderSettings settings,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canSavePlan,
            boolean canClearGenerationHistory,
            @Nullable RemovedRosterEntry pendingUndo
    ) {
        public BuilderState {
            party = party == null ? List.of() : List.copyOf(party);
            roster = roster == null ? List.of() : List.copyOf(roster);
            templateLabel = templateLabel == null ? "" : templateLabel;
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
        }

        static BuilderState empty(BuilderSettings settings) {
            return new BuilderState(
                    List.of(),
                    List.of(),
                    "",
                    new EncounterSessionSnapshot.DifficultySummary(0, 0, 0, 0, 0, ""),
                    List.of(),
                    settings,
                    false,
                    false,
                    false,
                    false,
                    false,
                    null);
        }
    }

    public record InitiativeEntry(String id, int initiative) {
        public InitiativeEntry {
            id = id == null ? "" : id;
        }
    }

    record ActionIntent(
            Action action,
            long creatureId,
            long savedPlanId,
            int delta,
            long undoToken,
            List<EncounterSessionSnapshot.InitiativeInput> initiatives,
            String combatantId,
            int initiative,
            long partyMemberId,
            int amount,
            boolean healing
    ) {
        ActionIntent {
            initiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
            combatantId = combatantId == null ? "" : combatantId;
        }
    }

    enum Action {
        REFRESH,
        GENERATE,
        SAVE_CURRENT_PLAN,
        OPEN_SAVED_PLAN,
        CLEAR_GENERATION_HISTORY,
        SHIFT_ALTERNATIVE,
        ADD_CREATURE,
        INCREMENT_CREATURE,
        DECREMENT_CREATURE,
        REMOVE_CREATURE,
        UNDO_REMOVE,
        OPEN_INITIATIVE,
        BACK_TO_BUILDER,
        CONFIRM_INITIATIVE,
        ADVANCE_TURN,
        SET_INITIATIVE,
        ADD_PARTY_MEMBER_TO_COMBAT,
        END_COMBAT,
        AWARD_XP,
        RETURN_TO_BUILDER_AFTER_RESULTS,
        MUTATE_HP
    }
}
