package src.view.statetabs.encounter;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.SavedEncounterPlanSummary;

final class EncounterBuilderStateContentModel {

    private final ReadOnlyObjectWrapper<PanelModel> panel =
            new ReadOnlyObjectWrapper<>(PanelModel.empty(BuilderSettings.defaultSettings()));

    ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    void showBuilder(
            EncounterStateSnapshot.BuilderPane source,
            String statusMessage
    ) {
        EncounterStateSnapshot.BuilderPane safeSource = source == null
                ? EncounterStateSnapshot.BuilderPane.empty()
                : source;
        EncounterStateSnapshot.ThresholdMeter difficulty = safeSource.thresholds();
        panel.set(new PanelModel(
                safeSource.partySummary(),
                safeSource.templateTitle(),
                new DifficultySummary(
                        difficulty.easyThreshold(),
                        difficulty.mediumThreshold(),
                        difficulty.hardThreshold(),
                        difficulty.deadlyThreshold(),
                        difficulty.adjustedXp(),
                        difficulty.difficultyLabel()),
                statusMessage,
                safeSource.generationHints(),
                safeSource.savedPlanChoices().stream()
                        .map(EncounterBuilderStateContentModel::toSavedPlan)
                        .toList(),
                toBuilderSettings(safeSource.currentSettings()),
                safeSource.rosterCards().stream()
                        .map(EncounterBuilderStateContentModel::toRosterCard)
                        .toList(),
                safeSource.rosterEmpty(),
                safeSource.startCombatEnabled(),
                safeSource.previousAlternativeEnabled(),
                safeSource.nextAlternativeEnabled(),
                safeSource.savePlanEnabled(),
                safeSource.clearHistoryEnabled(),
                safeSource.undoNotice() == null
                        ? null
                        : new UndoRemoveView(
                                safeSource.undoNotice().undoToken(),
                                safeSource.undoNotice().creatureName())));
    }

    PanelModel safePanel(PanelModel state) {
        return state == null
                ? PanelModel.empty(BuilderSettings.defaultSettings())
                : state;
    }

    private static SavedPlanView toSavedPlan(SavedEncounterPlanSummary plan) {
        return new SavedPlanView(
                plan.planId(),
                plan.name(),
                plan.summaryText());
    }

    private static RosterCardView toRosterCard(EncounterStateSnapshot.RosterCard creature) {
        return new RosterCardView(
                creature.creatureId(),
                creature.displayName(),
                creature.challengeRating(),
                creature.xpTotal(),
                creature.armorClass(),
                creature.creatureType(),
                creature.encounterRole(),
                creature.count());
    }

    private static BuilderSettings toBuilderSettings(EncounterStateSnapshot.BuilderSettings builderInputs) {
        EncounterStateSnapshot.BuilderSettings safeInputs = builderInputs == null
                ? EncounterStateSnapshot.BuilderSettings.defaultSettings()
                : builderInputs;
        return new BuilderSettings(
                safeInputs.difficultyLabel(),
                safeInputs.balanceLevel(),
                safeInputs.amountValue(),
                safeInputs.diversityLevel());
    }

    record BuilderSettings(
            String difficultyLabel,
            int balanceLevel,
            double amountValue,
            int diversityLevel
    ) {
        static BuilderSettings defaultSettings() {
            return new BuilderSettings("Auto", -1, -1.0, -1);
        }
    }

    record DifficultySummary(
            int easy,
            int medium,
            int hard,
            int deadly,
            int adjustedXp,
            String difficulty
    ) {
        DifficultySummary {
            difficulty = difficulty == null ? "" : difficulty;
        }
    }

    record PanelModel(
            String partyLabel,
            String templateLabel,
            DifficultySummary difficulty,
            String statusMessage,
            List<String> generationAdvisoryMessages,
            List<SavedPlanView> savedPlans,
            BuilderSettings settings,
            List<RosterCardView> roster,
            boolean showRosterPlaceholder,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canSavePlan,
            boolean canClearGenerationHistory,
            @Nullable UndoRemoveView pendingUndo
    ) {
        PanelModel {
            partyLabel = partyLabel == null ? "" : partyLabel;
            templateLabel = templateLabel == null ? "" : templateLabel;
            difficulty = difficulty == null ? new DifficultySummary(0, 0, 0, 0, 0, "") : difficulty;
            statusMessage = statusMessage == null ? "" : statusMessage;
            generationAdvisoryMessages = generationAdvisoryMessages == null
                    ? List.of()
                    : List.copyOf(generationAdvisoryMessages);
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
            settings = settings == null ? BuilderSettings.defaultSettings() : settings;
            roster = roster == null ? List.of() : List.copyOf(roster);
        }

        static PanelModel empty(BuilderSettings settings) {
            return new PanelModel(
                    "",
                    "",
                    new DifficultySummary(0, 0, 0, 0, 0, ""),
                    "",
                    List.of(),
                    List.of(),
                    settings,
                    List.of(),
                    true,
                    false,
                    false,
                    false,
                    false,
                    false,
                    null);
        }
    }

    record SavedPlanView(long id, String name, String summaryText) {
        SavedPlanView {
            name = name == null ? "" : name.trim();
            summaryText = summaryText == null ? "" : summaryText.trim();
        }
    }

    record RosterCardView(
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int armorClass,
            String type,
            String role,
            int count
    ) {
        RosterCardView {
            name = name == null ? "" : name;
            challengeRating = challengeRating == null ? "" : challengeRating;
            type = type == null ? "" : type;
            role = role == null ? "" : role;
            count = Math.max(1, count);
        }
    }

    record UndoRemoveView(long token, String creatureName) {
        UndoRemoveView {
            creatureName = creatureName == null ? "" : creatureName;
        }
    }
}
