package src.view.statetabs.encounter;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.published.EncounterStateSnapshot;

public final class EncounterStateContributionModel {

    private static final long UNSELECTED_CREATURE_ID = 0L;

    public enum Mode {
        BUILDER,
        INITIATIVE,
        COMBAT,
        RESULTS
    }

    private final ReadOnlyObjectWrapper<Mode> mode = new ReadOnlyObjectWrapper<>(Mode.BUILDER);
    private final ReadOnlyObjectWrapper<EncounterBuilderState> builderState =
            new ReadOnlyObjectWrapper<>(EncounterBuilderState.empty(EncounterBuilderSettings.defaultSettings()));
    private final ReadOnlyObjectWrapper<@Nullable Long> creatureDetailSelection = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<EncounterInitiativeStateViewModel> initiativeState =
            new ReadOnlyObjectWrapper<>(EncounterInitiativeStateViewModel.empty());
    private final ReadOnlyObjectWrapper<EncounterCombatStateViewModel> combatState =
            new ReadOnlyObjectWrapper<>(EncounterCombatStateViewModel.empty());
    private final ReadOnlyObjectWrapper<EncounterResultStateView> resultState =
            new ReadOnlyObjectWrapper<>(EncounterResultStateView.empty());
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("Encounter bereit.");

    ReadOnlyObjectProperty<Mode> modeProperty() {
        return mode.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<EncounterBuilderState> builderStateProperty() {
        return builderState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<@Nullable Long> creatureDetailSelectionProperty() {
        return creatureDetailSelection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<EncounterInitiativeStateViewModel> initiativeStateProperty() {
        return initiativeState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<EncounterCombatStateViewModel> combatStateProperty() {
        return combatState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<EncounterResultStateView> resultStateProperty() {
        return resultState.getReadOnlyProperty();
    }

    ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    void selectCreatureDetail(long creatureId) {
        if (creatureId <= UNSELECTED_CREATURE_ID) {
            return;
        }
        creatureDetailSelection.set(creatureId);
    }

    void clearCreatureDetailSelection() {
        creatureDetailSelection.set(null);
    }

    void apply(EncounterStateSnapshot snapshot) {
        EncounterStateSnapshot safeSnapshot = snapshot == null ? EncounterStateSnapshot.empty("") : snapshot;
        EncounterSnapshotMapper.MappedState mappedState = EncounterSnapshotMapper.map(safeSnapshot);
        mode.set(mappedState.mode());
        builderState.set(mappedState.builderState());
        initiativeState.set(mappedState.initiativeState());
        combatState.set(mappedState.combatState());
        resultState.set(mappedState.resultState());
        status.set(safeSnapshot.statusLine());
    }

}

record EncounterBuilderSettings(
            String difficultyLabel,
            int balanceLevel,
            double amountValue,
            int diversityLevel
    ) {
        static EncounterBuilderSettings defaultSettings() {
            return new EncounterBuilderSettings("Auto", -1, -1.0, -1);
        }
    }

record EncounterDifficultySummary(
            int easy,
            int medium,
            int hard,
            int deadly,
            int adjustedXp,
            String difficulty
    ) {
        EncounterDifficultySummary {
            difficulty = difficulty == null ? "" : difficulty;
        }
    }

record EncounterBuilderState(
            String partyLabel,
            String templateLabel,
            EncounterDifficultySummary difficulty,
            String statusMessage,
            List<String> generationAdvisoryMessages,
            List<EncounterSavedPlanView> savedPlans,
            EncounterBuilderSettings settings,
            List<EncounterRosterCardView> roster,
            boolean showRosterPlaceholder,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canSavePlan,
            boolean canClearGenerationHistory,
            @Nullable EncounterUndoRemoveView pendingUndo
    ) {
        EncounterBuilderState {
            partyLabel = partyLabel == null ? "" : partyLabel;
            templateLabel = templateLabel == null ? "" : templateLabel;
            difficulty = difficulty == null ? new EncounterDifficultySummary(0, 0, 0, 0, 0, "") : difficulty;
            statusMessage = statusMessage == null ? "" : statusMessage;
            generationAdvisoryMessages = generationAdvisoryMessages == null ? List.of() : List.copyOf(generationAdvisoryMessages);
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
            settings = settings == null ? EncounterBuilderSettings.defaultSettings() : settings;
            roster = roster == null ? List.of() : List.copyOf(roster);
        }

        static EncounterBuilderState empty(EncounterBuilderSettings settings) {
            return new EncounterBuilderState(
                    "",
                    "",
                    new EncounterDifficultySummary(0, 0, 0, 0, 0, ""),
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

record EncounterSavedPlanView(long id, String name, String summaryText) {
        EncounterSavedPlanView {
            name = name == null ? "" : name.trim();
            summaryText = summaryText == null ? "" : summaryText.trim();
        }
    }

record EncounterRosterCardView(
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int armorClass,
            String type,
            String role,
            int count
    ) {
        EncounterRosterCardView {
            name = name == null ? "" : name;
            challengeRating = challengeRating == null ? "" : challengeRating;
            type = type == null ? "" : type;
            role = role == null ? "" : role;
            count = Math.max(1, count);
        }
    }

record EncounterUndoRemoveView(long token, String creatureName) {
        EncounterUndoRemoveView {
            creatureName = creatureName == null ? "" : creatureName;
        }
    }

record EncounterInitiativeEntryView(String id, String label, String kind, int initiative) {
        EncounterInitiativeEntryView {
            id = id == null ? "" : id;
            label = label == null ? "" : label;
            kind = kind == null ? "" : kind;
        }
    }

record EncounterInitiativeStateViewModel(List<EncounterInitiativeEntryView> entries) {
        EncounterInitiativeStateViewModel {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }

        static EncounterInitiativeStateViewModel empty() {
            return new EncounterInitiativeStateViewModel(List.of());
        }
    }

record EncounterCombatCardView(
            String id,
            String name,
            boolean playerCharacter,
            boolean active,
            boolean alive,
            int currentHp,
            int maxHp,
            int armorClass,
            int initiative,
            int count,
            String detail
    ) {
        EncounterCombatCardView {
            id = id == null ? "" : id;
            name = name == null ? "" : name;
            detail = detail == null ? "" : detail;
            count = Math.max(1, count);
        }
    }

record EncounterPartyMemberCandidate(long memberId, String name, int level) {
        EncounterPartyMemberCandidate {
            memberId = Math.max(0L, memberId);
            name = name == null ? "" : name;
        }
    }

record EncounterCombatStateViewModel(
            int round,
            String status,
            List<EncounterCombatCardView> cards,
            boolean allEnemiesDefeated,
            List<EncounterPartyMemberCandidate> missingPartyMembers
    ) {
        EncounterCombatStateViewModel {
            status = status == null ? "" : status;
            cards = cards == null ? List.of() : List.copyOf(cards);
            missingPartyMembers = missingPartyMembers == null ? List.of() : List.copyOf(missingPartyMembers);
        }

        static EncounterCombatStateViewModel empty() {
            return new EncounterCombatStateViewModel(0, "", List.of(), false, List.of());
        }
    }

record EncounterResultEnemyView(String name, String status, int hpLoss, int xp, boolean defeatedByDefault, String loot) {
        EncounterResultEnemyView {
            name = name == null ? "" : name;
            status = status == null ? "" : status;
            loot = loot == null ? "" : loot;
        }
    }

record EncounterResultStateView(
            List<EncounterResultEnemyView> enemies,
            long defeatedCount,
            int eligibleXp,
            int perPlayerXp,
            String goldSummary,
            String lootDetail,
            String awardStatus,
            boolean xpAwarded,
            boolean canAwardXp,
            int partySize
    ) {
        EncounterResultStateView {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
            goldSummary = goldSummary == null ? "" : goldSummary;
            lootDetail = lootDetail == null ? "" : lootDetail;
            awardStatus = awardStatus == null ? "" : awardStatus;
            partySize = Math.max(1, partySize);
        }

        static EncounterResultStateView empty() {
            return new EncounterResultStateView(List.of(), 0, 0, 0, "Kein Loot", "", "", false, false, 1);
        }
    }

final class EncounterSnapshotMapper {

        private EncounterSnapshotMapper() {
        }

        record MappedState(
                EncounterStateContributionModel.Mode mode,
                EncounterBuilderState builderState,
                EncounterInitiativeStateViewModel initiativeState,
                EncounterCombatStateViewModel combatState,
                EncounterResultStateView resultState
        ) {
        }

        static MappedState map(EncounterStateSnapshot snapshot) {
            return new MappedState(
                    toMode(snapshot.activeMode()),
                    toBuilderState(snapshot.builderPane(), snapshot.statusLine()),
                    toInitiativeState(snapshot.initiativePane()),
                    toCombatState(snapshot.combatPane()),
                    toResultState(snapshot.resolutionPane()));
        }

        private static EncounterStateContributionModel.Mode toMode(EncounterStateSnapshot.Mode source) {
            EncounterStateSnapshot.Mode effective = source == null ? EncounterStateSnapshot.Mode.BUILDER : source;
            return EncounterStateContributionModel.Mode.valueOf(effective.name());
        }

        private static EncounterBuilderState toBuilderState(
                EncounterStateSnapshot.BuilderPane source,
                String statusMessage
        ) {
            EncounterStateSnapshot.BuilderPane safeSource = source == null
                    ? EncounterStateSnapshot.BuilderPane.empty()
                    : source;
            EncounterStateSnapshot.ThresholdMeter difficulty = safeSource.thresholds();
            return new EncounterBuilderState(
                    safeSource.partySummary(),
                    safeSource.templateTitle(),
                    new EncounterDifficultySummary(
                            difficulty.easyThreshold(),
                            difficulty.mediumThreshold(),
                            difficulty.hardThreshold(),
                            difficulty.deadlyThreshold(),
                            difficulty.adjustedXp(),
                            difficulty.difficultyLabel()),
                    statusMessage,
                    safeSource.generationHints(),
                    safeSource.savedPlanChoices().stream()
                            .map(EncounterSnapshotMapper::toSavedPlan)
                            .toList(),
                    toBuilderSettings(safeSource.currentSettings()),
                    safeSource.rosterCards().stream()
                            .map(EncounterSnapshotMapper::toRosterCard)
                            .toList(),
                    safeSource.rosterEmpty(),
                    safeSource.startCombatEnabled(),
                    safeSource.previousAlternativeEnabled(),
                    safeSource.nextAlternativeEnabled(),
                    safeSource.savePlanEnabled(),
                    safeSource.clearHistoryEnabled(),
                    safeSource.undoNotice() == null
                            ? null
                            : new EncounterUndoRemoveView(
                                    safeSource.undoNotice().undoToken(),
                                    safeSource.undoNotice().creatureName()));
        }

        private static EncounterInitiativeStateViewModel toInitiativeState(EncounterStateSnapshot.InitiativePane source) {
            EncounterStateSnapshot.InitiativePane safeSource = source == null
                    ? EncounterStateSnapshot.InitiativePane.empty()
                    : source;
            return new EncounterInitiativeStateViewModel(safeSource.rows().stream()
                    .map(entry -> new EncounterInitiativeEntryView(
                            entry.combatantId(),
                            entry.displayLabel(),
                            entry.kindLabel(),
                            entry.initiativeValue()))
                    .toList());
        }

        private static EncounterCombatStateViewModel toCombatState(EncounterStateSnapshot.CombatPane source) {
            EncounterStateSnapshot.CombatPane safeSource = source == null
                    ? EncounterStateSnapshot.CombatPane.empty()
                    : source;
            return new EncounterCombatStateViewModel(
                    safeSource.roundIndex(),
                    safeSource.combatStatus(),
                    safeSource.combatCards().stream()
                            .map(card -> new EncounterCombatCardView(
                                    card.combatantId(),
                                    card.displayName(),
                                    card.playerCharacter(),
                                    card.activeTurn(),
                                    card.alive(),
                                    card.currentHp(),
                                    card.maxHp(),
                                    card.armorClass(),
                                    card.initiativeValue(),
                                    card.count(),
                                    card.detailText()))
                            .toList(),
                    safeSource.allEnemiesDefeated(),
                    safeSource.addablePartyMembers().stream()
                            .map(member -> new EncounterPartyMemberCandidate(
                                    member.partyMemberId(),
                                    member.displayName(),
                                    member.level()))
                            .toList());
        }

        private static EncounterResultStateView toResultState(EncounterStateSnapshot.ResolutionPane source) {
            EncounterStateSnapshot.ResolutionPane safeSource = source == null
                    ? EncounterStateSnapshot.ResolutionPane.empty()
                    : source;
            return new EncounterResultStateView(
                    safeSource.enemyResults().stream()
                            .map(enemy -> new EncounterResultEnemyView(
                                    enemy.displayName(),
                                    enemy.statusLabel(),
                                    enemy.hpLoss(),
                                    enemy.xp(),
                                    enemy.defeatedByDefault(),
                                    enemy.loot()))
                            .toList(),
                    safeSource.defeatedCount(),
                    safeSource.eligibleXp(),
                    safeSource.perPlayerXp(),
                    safeSource.goldSummary(),
                    safeSource.lootDetail(),
                    safeSource.awardStatus(),
                    safeSource.xpAwarded(),
                    safeSource.canAwardXp(),
                    safeSource.partySize());
        }

        private static EncounterSavedPlanView toSavedPlan(src.domain.encounter.published.SavedEncounterPlanSummary plan) {
            return new EncounterSavedPlanView(
                    plan.planId(),
                    plan.name(),
                    plan.summaryText());
        }

        private static EncounterRosterCardView toRosterCard(EncounterStateSnapshot.RosterCard creature) {
            return new EncounterRosterCardView(
                    creature.creatureId(),
                    creature.displayName(),
                    creature.challengeRating(),
                    creature.xpTotal(),
                    creature.armorClass(),
                    creature.creatureType(),
                    creature.encounterRole(),
                    creature.count());
        }

        private static EncounterBuilderSettings toBuilderSettings(EncounterStateSnapshot.BuilderSettings builderInputs) {
            EncounterStateSnapshot.BuilderSettings safeInputs = builderInputs == null
                    ? EncounterStateSnapshot.BuilderSettings.defaultSettings()
                    : builderInputs;
            return new EncounterBuilderSettings(
                    safeInputs.difficultyLabel(),
                    safeInputs.balanceLevel(),
                    safeInputs.amountValue(),
                    safeInputs.diversityLevel());
        }
}
