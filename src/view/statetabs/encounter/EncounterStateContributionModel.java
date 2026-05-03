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

public final class EncounterStateContributionModel {

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

    EncounterStateContributionModel() {
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

}
