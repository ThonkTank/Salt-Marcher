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
    private final ReadOnlyObjectWrapper<BuilderState> builderState =
            new ReadOnlyObjectWrapper<>(BuilderState.empty(BuilderSettings.defaultSettings()));
    private final ReadOnlyObjectWrapper<@Nullable Long> creatureDetailSelection = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<InitiativeStateView> initiativeState =
            new ReadOnlyObjectWrapper<>(InitiativeStateView.empty());
    private final ReadOnlyObjectWrapper<CombatStateView> combatState =
            new ReadOnlyObjectWrapper<>(CombatStateView.empty());
    private final ReadOnlyObjectWrapper<ResultStateView> resultState =
            new ReadOnlyObjectWrapper<>(ResultStateView.empty());
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("Encounter bereit.");

    ReadOnlyObjectProperty<Mode> modeProperty() {
        return mode.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<BuilderState> builderStateProperty() {
        return builderState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<@Nullable Long> creatureDetailSelectionProperty() {
        return creatureDetailSelection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<InitiativeStateView> initiativeStateProperty() {
        return initiativeState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<CombatStateView> combatStateProperty() {
        return combatState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<ResultStateView> resultStateProperty() {
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
        SnapshotMapper.MappedState mappedState = SnapshotMapper.map(safeSnapshot);
        mode.set(mappedState.mode());
        builderState.set(mappedState.builderState());
        initiativeState.set(mappedState.initiativeState());
        combatState.set(mappedState.combatState());
        resultState.set(mappedState.resultState());
        status.set(safeSnapshot.statusLine());
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

    public record DifficultySummary(
            int easy,
            int medium,
            int hard,
            int deadly,
            int adjustedXp,
            String difficulty
    ) {
        public DifficultySummary {
            difficulty = difficulty == null ? "" : difficulty;
        }
    }

    public record BuilderState(
            String partyLabel,
            String templateLabel,
            DifficultySummary difficulty,
            String statusMessage,
            List<String> generationAdvisoryMessages,
            List<SavedEncounterPlanView> savedPlans,
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
        public BuilderState {
            partyLabel = partyLabel == null ? "" : partyLabel;
            templateLabel = templateLabel == null ? "" : templateLabel;
            difficulty = difficulty == null ? new DifficultySummary(0, 0, 0, 0, 0, "") : difficulty;
            statusMessage = statusMessage == null ? "" : statusMessage;
            generationAdvisoryMessages = generationAdvisoryMessages == null ? List.of() : List.copyOf(generationAdvisoryMessages);
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
            settings = settings == null ? BuilderSettings.defaultSettings() : settings;
            roster = roster == null ? List.of() : List.copyOf(roster);
        }

        static BuilderState empty(BuilderSettings settings) {
            return new BuilderState(
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

    public record SavedEncounterPlanView(long id, String name, String summaryText) {
        public SavedEncounterPlanView {
            name = name == null ? "" : name.trim();
            summaryText = summaryText == null ? "" : summaryText.trim();
        }
    }

    public record RosterCardView(
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int armorClass,
            String type,
            String role,
            int count
    ) {
        public RosterCardView {
            name = name == null ? "" : name;
            challengeRating = challengeRating == null ? "" : challengeRating;
            type = type == null ? "" : type;
            role = role == null ? "" : role;
            count = Math.max(1, count);
        }
    }

    public record UndoRemoveView(long token, String creatureName) {
        public UndoRemoveView {
            creatureName = creatureName == null ? "" : creatureName;
        }
    }

    public record InitiativeEntryView(String id, String label, String kind, int initiative) {
        public InitiativeEntryView {
            id = id == null ? "" : id;
            label = label == null ? "" : label;
            kind = kind == null ? "" : kind;
        }
    }

    public record InitiativeStateView(List<InitiativeEntryView> entries) {
        public InitiativeStateView {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }

        static InitiativeStateView empty() {
            return new InitiativeStateView(List.of());
        }
    }

    public record CombatCardView(
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
        public CombatCardView {
            id = id == null ? "" : id;
            name = name == null ? "" : name;
            detail = detail == null ? "" : detail;
            count = Math.max(1, count);
        }
    }

    public record PartyMemberCandidate(long memberId, String name, int level) {
        public PartyMemberCandidate {
            memberId = Math.max(0L, memberId);
            name = name == null ? "" : name;
        }
    }

    public record CombatStateView(
            int round,
            String status,
            List<CombatCardView> cards,
            boolean allEnemiesDefeated,
            List<PartyMemberCandidate> missingPartyMembers
    ) {
        public CombatStateView {
            status = status == null ? "" : status;
            cards = cards == null ? List.of() : List.copyOf(cards);
            missingPartyMembers = missingPartyMembers == null ? List.of() : List.copyOf(missingPartyMembers);
        }

        static CombatStateView empty() {
            return new CombatStateView(0, "", List.of(), false, List.of());
        }
    }

    public record ResultEnemyView(String name, String status, int hpLoss, int xp, boolean defeatedByDefault, String loot) {
        public ResultEnemyView {
            name = name == null ? "" : name;
            status = status == null ? "" : status;
            loot = loot == null ? "" : loot;
        }
    }

    public record ResultStateView(
            List<ResultEnemyView> enemies,
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
        public ResultStateView {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
            goldSummary = goldSummary == null ? "" : goldSummary;
            lootDetail = lootDetail == null ? "" : lootDetail;
            awardStatus = awardStatus == null ? "" : awardStatus;
            partySize = Math.max(1, partySize);
        }

        static ResultStateView empty() {
            return new ResultStateView(List.of(), 0, 0, 0, "Kein Loot", "", "", false, false, 1);
        }
    }

    private static final class SnapshotMapper {

        private record MappedState(
                Mode mode,
                BuilderState builderState,
                InitiativeStateView initiativeState,
                CombatStateView combatState,
                ResultStateView resultState
        ) {
        }

        private static MappedState map(EncounterStateSnapshot snapshot) {
            return new MappedState(
                    toMode(snapshot.activeMode()),
                    toBuilderState(snapshot.builderPane(), snapshot.statusLine()),
                    toInitiativeState(snapshot.initiativePane()),
                    toCombatState(snapshot.combatPane()),
                    toResultState(snapshot.resolutionPane()));
        }

        private static Mode toMode(EncounterStateSnapshot.Mode source) {
            EncounterStateSnapshot.Mode effective = source == null ? EncounterStateSnapshot.Mode.BUILDER : source;
            return Mode.valueOf(effective.name());
        }

        private static BuilderState toBuilderState(
                EncounterStateSnapshot.BuilderPane source,
                String statusMessage
        ) {
            EncounterStateSnapshot.BuilderPane safeSource = source == null
                    ? EncounterStateSnapshot.BuilderPane.empty()
                    : source;
            EncounterStateSnapshot.ThresholdMeter difficulty = safeSource.thresholds();
            return new BuilderState(
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
                            .map(SnapshotMapper::toSavedPlan)
                            .toList(),
                    toBuilderSettings(safeSource.currentSettings()),
                    safeSource.rosterCards().stream()
                            .map(SnapshotMapper::toRosterCard)
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
                                    safeSource.undoNotice().creatureName()));
        }

        private static InitiativeStateView toInitiativeState(EncounterStateSnapshot.InitiativePane source) {
            EncounterStateSnapshot.InitiativePane safeSource = source == null
                    ? EncounterStateSnapshot.InitiativePane.empty()
                    : source;
            return new InitiativeStateView(safeSource.rows().stream()
                    .map(entry -> new InitiativeEntryView(
                            entry.combatantId(),
                            entry.displayLabel(),
                            entry.kindLabel(),
                            entry.initiativeValue()))
                    .toList());
        }

        private static CombatStateView toCombatState(EncounterStateSnapshot.CombatPane source) {
            EncounterStateSnapshot.CombatPane safeSource = source == null
                    ? EncounterStateSnapshot.CombatPane.empty()
                    : source;
            return new CombatStateView(
                    safeSource.roundIndex(),
                    safeSource.combatStatus(),
                    safeSource.combatCards().stream()
                            .map(card -> new CombatCardView(
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
                            .map(member -> new PartyMemberCandidate(
                                    member.partyMemberId(),
                                    member.displayName(),
                                    member.level()))
                            .toList());
        }

        private static ResultStateView toResultState(EncounterStateSnapshot.ResolutionPane source) {
            EncounterStateSnapshot.ResolutionPane safeSource = source == null
                    ? EncounterStateSnapshot.ResolutionPane.empty()
                    : source;
            return new ResultStateView(
                    safeSource.enemyResults().stream()
                            .map(enemy -> new ResultEnemyView(
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

        private static SavedEncounterPlanView toSavedPlan(src.domain.encounter.published.SavedEncounterPlanSummary plan) {
            return new SavedEncounterPlanView(
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
    }
}
