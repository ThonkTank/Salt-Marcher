package src.view.statetabs.encounter;

import java.util.List;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;

public final class EncounterStateView extends VBox {

    private final StackPane contentArea = new StackPane();

    public EncounterStateView() {
        setSpacing(0);
        setPadding(new Insets(0));
        getStyleClass().add("surface-root");
        setFillWidth(true);
        VBox.setVgrow(contentArea, Priority.ALWAYS);
        getChildren().add(contentArea);
    }

    public void showContent(Node node) {
        if (contentArea.getChildren().size() == 1 && contentArea.getChildren().get(0) == node) {
            return;
        }
        contentArea.getChildren().setAll(node);
    }

    public record BuilderSettingsInput(String difficultyLabel, int balanceLevel, double amountValue, int diversityLevel) {
        static BuilderSettingsInput defaultInput() {
            return new BuilderSettingsInput("Auto", -1, -1.0, -1);
        }
    }

    public record BuilderStateView(
            String partyLabel,
            String templateLabel,
            DifficultySummaryView difficulty,
            String statusMessage,
            List<String> generationAdvisoryMessages,
            List<SavedEncounterPlanView> savedPlans,
            BuilderSettingsInput settings,
            List<RosterCardView> roster,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canSavePlan,
            boolean canClearGenerationHistory,
            @Nullable UndoRemoveView pendingUndo
    ) {
        static BuilderStateView empty() {
            return new BuilderStateView(
                "",
                "",
                new DifficultySummaryView(0, 0, 0, 0, 0, ""),
                "",
                List.of(),
                List.of(),
                BuilderSettingsInput.defaultInput(),
                List.of(),
                    false,
                    false,
                    false,
                    false,
                    false,
                    null);
        }

        public BuilderStateView {
            statusMessage = statusMessage == null ? "" : statusMessage;
            generationAdvisoryMessages = generationAdvisoryMessages == null ? List.of() : List.copyOf(generationAdvisoryMessages);
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
            roster = roster == null ? List.of() : List.copyOf(roster);
        }
    }

    public record SavedEncounterPlanView(long id, String name, String generatedLabel, int creatureCount) {
        public SavedEncounterPlanView {
            name = name == null ? "" : name.trim();
            generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            creatureCount = Math.max(0, creatureCount);
        }
    }

    public record DifficultySummaryView(int easy, int medium, int hard, int deadly, int adjustedXp, String difficulty) {
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
    }

    public record UndoRemoveView(long token, String creatureName) {
    }

    public record InitiativeEntryView(String id, String label, String kind, int initiative) {
    }

    public record InitiativeStateView(List<InitiativeEntryView> entries) {
        public InitiativeStateView {
            entries = entries == null ? List.of() : List.copyOf(entries);
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
    }

    public record CombatStateView(
            int round,
            String status,
            List<CombatCardView> cards,
            boolean allEnemiesDefeated,
            List<PartyMemberCandidate> missingPartyMembers
    ) {
        public CombatStateView {
            cards = cards == null ? List.of() : List.copyOf(cards);
            missingPartyMembers = missingPartyMembers == null ? List.of() : List.copyOf(missingPartyMembers);
        }
    }

    public record PartyMemberCandidate(long memberId, String name, int level) {
    }

    public record ResultEnemyView(String name, String status, int hpLoss, int xp, boolean defeatedByDefault, String loot) {
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
            partySize = Math.max(1, partySize);
        }

        static ResultStateView empty() {
            return new ResultStateView(List.of(), 0, 0, 0, "Kein Loot", "", "", false, false, 1);
        }
    }
}
