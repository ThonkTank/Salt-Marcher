package src.view.statetabs.encounter;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.published.EncounterGenerationAdvisory;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.SavedEncounterPlanSummary;

public final class EncounterStateContributionModel {

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

    EncounterStateContributionModel() {
    }

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
        if (creatureId <= 0L) {
            return;
        }
        creatureDetailSelection.set(creatureId);
    }

    void clearCreatureDetailSelection() {
        creatureDetailSelection.set(null);
    }

    void apply(EncounterSessionSnapshot snapshot) {
        EncounterSessionSnapshot safeSnapshot = snapshot == null ? EncounterSessionSnapshot.empty("") : snapshot;
        mode.set(toMode(safeSnapshot.mode()));
        builderState.set(toBuilderState(safeSnapshot.builderState(), safeSnapshot.status()));
        initiativeState.set(toInitiativeState(safeSnapshot.initiativeState()));
        combatState.set(toCombatState(safeSnapshot.combatState(), safeSnapshot.missingCombatPartyMembers()));
        resultState.set(toResultState(safeSnapshot.resultState()));
        status.set(safeSnapshot.status());
    }

    private static Mode toMode(EncounterSessionSnapshot.Mode source) {
        return switch (source == null ? EncounterSessionSnapshot.Mode.BUILDER : source) {
            case BUILDER -> Mode.BUILDER;
            case INITIATIVE -> Mode.INITIATIVE;
            case COMBAT -> Mode.COMBAT;
            case RESULTS -> Mode.RESULTS;
        };
    }

    private static BuilderState toBuilderState(
            EncounterSessionSnapshot.BuilderState source,
            String statusMessage
    ) {
        EncounterSessionSnapshot.BuilderState safeSource = source == null
                ? EncounterSessionSnapshot.BuilderState.empty()
                : source;
        EncounterSessionSnapshot.DifficultySummary difficulty = safeSource.difficulty();
        String partyLabel = "Party: " + safeSource.party().size() + ", Lv "
                + Math.round(safeSource.party().stream()
                .mapToInt(EncounterSessionSnapshot.PartyMember::level)
                .average()
                .orElse(1.0));
        return new BuilderState(
                partyLabel,
                safeSource.templateLabel(),
                new DifficultySummary(
                        difficulty.easy(),
                        difficulty.medium(),
                        difficulty.hard(),
                        difficulty.deadly(),
                        difficulty.adjustedXp(),
                        difficulty.difficulty()),
                statusMessage,
                toAdvisoryMessages(safeSource.generationAdvisories()),
                safeSource.savedPlans().stream()
                        .map(EncounterStateContributionModel::toSavedPlan)
                        .toList(),
                toBuilderSettings(safeSource.builderInputs()),
                safeSource.roster().stream()
                        .map(EncounterStateContributionModel::toRosterCard)
                        .toList(),
                safeSource.roster().isEmpty(),
                safeSource.canStartCombat(),
                safeSource.canPreviousAlternative(),
                safeSource.canNextAlternative(),
                safeSource.canSavePlan(),
                safeSource.canClearGenerationHistory(),
                safeSource.pendingUndo() == null
                        ? null
                        : new UndoRemoveView(safeSource.pendingUndo().token(), safeSource.pendingUndo().creature().name()));
    }

    private static InitiativeStateView toInitiativeState(EncounterSessionSnapshot.InitiativeState source) {
        EncounterSessionSnapshot.InitiativeState safeSource = source == null
                ? EncounterSessionSnapshot.InitiativeState.empty()
                : source;
        return new InitiativeStateView(safeSource.entries().stream()
                .map(entry -> new InitiativeEntryView(
                        entry.id(),
                        entry.label(),
                        entry.kind(),
                        entry.initiative()))
                .toList());
    }

    private static CombatStateView toCombatState(
            EncounterSessionSnapshot.CombatProjection source,
            List<EncounterSessionSnapshot.PartyMember> missingPartyMembers
    ) {
        EncounterSessionSnapshot.CombatProjection safeSource = source == null
                ? EncounterSessionSnapshot.CombatProjection.empty()
                : source;
        List<EncounterSessionSnapshot.PartyMember> safeMissing = missingPartyMembers == null
                ? List.of()
                : List.copyOf(missingPartyMembers);
        return new CombatStateView(
                safeSource.round(),
                safeSource.status(),
                safeSource.cards().stream()
                        .map(card -> new CombatCardView(
                                card.id(),
                                card.name(),
                                card.playerCharacter(),
                                card.active(),
                                card.alive(),
                                card.currentHp(),
                                card.maxHp(),
                                card.armorClass(),
                                card.initiative(),
                                card.count(),
                                card.detail()))
                        .toList(),
                safeSource.allEnemiesDefeated(),
                safeMissing.stream()
                        .map(member -> new PartyMemberCandidate(
                                member.numericId(),
                                member.name(),
                                member.level()))
                        .toList());
    }

    private static ResultStateView toResultState(EncounterSessionSnapshot.ResultState source) {
        EncounterSessionSnapshot.ResultState safeSource = source == null
                ? EncounterSessionSnapshot.ResultState.empty()
                : source;
        return new ResultStateView(
                safeSource.enemies().stream()
                        .map(enemy -> new ResultEnemyView(
                                enemy.name(),
                                enemy.status(),
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

    private static SavedEncounterPlanView toSavedPlan(SavedEncounterPlanSummary plan) {
        return new SavedEncounterPlanView(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                plan.creatureCount());
    }

    private static RosterCardView toRosterCard(EncounterSessionSnapshot.EncounterCreature creature) {
        return new RosterCardView(
                creature.creatureId(),
                creature.name(),
                creature.cr(),
                creature.totalXp(),
                creature.ac(),
                creature.type(),
                creature.role(),
                creature.count());
    }

    private static BuilderSettings toBuilderSettings(EncounterSessionSnapshot.BuilderInputs builderInputs) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        return new BuilderSettings(
                difficultyLabel(safeInputs.targetDifficulty()),
                safeInputs.tuning().balanceLevel(),
                safeInputs.tuning().amountValue(),
                safeInputs.tuning().diversityLevel());
    }

    private static String difficultyLabel(src.domain.encounter.published.EncounterDifficultyBand difficulty) {
        if (difficulty == null || difficulty.isAuto()) {
            return "Auto";
        }
        return difficulty.name();
    }

    private static List<String> toAdvisoryMessages(List<EncounterGenerationAdvisory> advisories) {
        return advisories == null ? List.of() : advisories.stream()
                .map(EncounterStateContributionModel::advisoryMessage)
                .toList();
    }

    private static String advisoryMessage(EncounterGenerationAdvisory advisory) {
        if (advisory == EncounterGenerationAdvisory.AUTO_RESOLVED) {
            return "Auto-Einstellungen wurden fuer diese Generierung auf konkrete Zielwerte aufgeloest.";
        }
        return "Kein exakter Treffer war verfuegbar. Die beste gefundene Alternative wurde uebernommen.";
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

    public record SavedEncounterPlanView(long id, String name, String generatedLabel, int creatureCount) {
        public SavedEncounterPlanView {
            name = name == null ? "" : name.trim();
            generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            creatureCount = Math.max(0, creatureCount);
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
}
