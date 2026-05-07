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
        mode.set(EncounterStateProjectionMapper.toMode(safeSnapshot.activeMode()));
        builderState.set(EncounterStateProjectionMapper.toBuilderState(safeSnapshot.builderPane(), safeSnapshot.statusLine()));
        initiativeState.set(EncounterStateProjectionMapper.toInitiativeState(safeSnapshot.initiativePane()));
        combatState.set(EncounterStateProjectionMapper.toCombatState(safeSnapshot.combatPane()));
        resultState.set(EncounterStateProjectionMapper.toResultState(safeSnapshot.resolutionPane()));
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
