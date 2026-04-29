package src.view.leftbartabs.sessionplanner;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class SessionPlannerMainView extends ScrollPane {

    private final VBox content = new VBox(16);
    private final VBox timelineBox = new VBox(8);
    private final VBox lootBox = new VBox(6);
    private final Label emptyTimelineLabel = new Label("Noch keine Encounter importiert.");
    private List<SessionPlannerContributionModel.EncounterModel> encounters = List.of();
    private List<SessionPlannerContributionModel.RestGapModel> gaps = List.of();
    private Consumer<SessionPlannerMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerMainView() {
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setContent(content);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);

        content.getStyleClass().add("session-planner-main");
        content.setPadding(new Insets(10));
        content.getChildren().addAll(timelineSection(), lootSection());
        emptyTimelineLabel.getStyleClass().addAll("text-secondary", "session-planner-empty");
    }

    public void showTimeline(
            List<SessionPlannerContributionModel.EncounterModel> encounters,
            List<SessionPlannerContributionModel.RestGapModel> gaps
    ) {
        this.encounters = encounters == null ? List.of() : List.copyOf(encounters);
        this.gaps = gaps == null ? List.of() : List.copyOf(gaps);
        renderTimeline();
    }

    public void showLootPlaceholders(List<SessionPlannerContributionModel.LootModel> lootPlaceholders) {
        lootBox.getChildren().clear();
        List<SessionPlannerContributionModel.LootModel> safe = lootPlaceholders == null ? List.of() : List.copyOf(lootPlaceholders);
        if (safe.isEmpty()) {
            Label empty = new Label("Keine Loot-Platzhalter angelegt.");
            empty.getStyleClass().addAll("text-secondary", "session-planner-empty");
            lootBox.getChildren().add(empty);
            return;
        }
        for (SessionPlannerContributionModel.LootModel loot : safe) {
            lootBox.getChildren().add(lootCard(loot));
        }
    }

    public void onViewInputEvent(Consumer<SessionPlannerMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private VBox timelineSection() {
        Label header = new Label("Abenteuerablauf");
        header.getStyleClass().addAll("section-header", "text-muted");
        VBox section = new VBox(8, header, timelineBox);
        return section;
    }

    private VBox lootSection() {
        Label header = new Label("Loot-Platzhalter");
        header.getStyleClass().addAll("section-header", "text-muted");
        Button addButton = new Button("Loot-Platzhalter");
        addButton.getStyleClass().addAll("compact", "accent");
        addButton.setOnAction(event -> viewInputEventHandler.accept(SessionPlannerMainViewInputEvent.addLootPlaceholder()));
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox row = new HBox(8, header, spacer, addButton);
        row.setAlignment(Pos.CENTER_LEFT);
        return new VBox(8, row, lootBox);
    }

    private void renderTimeline() {
        timelineBox.getChildren().clear();
        if (encounters.isEmpty()) {
            timelineBox.getChildren().add(emptyTimelineLabel);
            return;
        }
        for (int index = 0; index < encounters.size(); index++) {
            SessionPlannerContributionModel.EncounterModel encounter = encounters.get(index);
            timelineBox.getChildren().add(encounterCard(encounter, index + 1));
            if (index < gaps.size()) {
                timelineBox.getChildren().add(restGapCard(gaps.get(index), index + 1, index + 2));
            }
        }
    }

    private VBox encounterCard(SessionPlannerContributionModel.EncounterModel encounter, int position) {
        Label title = new Label(position + ". " + encounter.name());
        title.getStyleClass().add("session-planner-encounter-title");
        Label meta = new Label(encounter.creatureCount() + " Kreaturen"
                + (encounter.generatedLabel().isBlank() ? "" : " · " + encounter.generatedLabel()));
        meta.getStyleClass().add("text-secondary");
        Label budget = new Label("Adj. XP " + encounter.adjustedXp()
                + " · Base XP " + encounter.totalBaseXp()
                + " · " + encounter.difficultyLabel());
        budget.getStyleClass().add("session-planner-encounter-budget");
        Label multiplier = new Label("Multiplikator x" + String.format(java.util.Locale.US, "%.2f", encounter.xpMultiplier()));
        multiplier.getStyleClass().add("text-secondary");

        Button up = new Button("Hoch");
        up.getStyleClass().addAll("compact", "flat");
        up.setDisable(!encounter.canMoveUp());
        up.setOnAction(event -> viewInputEventHandler.accept(SessionPlannerMainViewInputEvent.moveEncounterUp(encounter.token())));

        Button down = new Button("Runter");
        down.getStyleClass().addAll("compact", "flat");
        down.setDisable(!encounter.canMoveDown());
        down.setOnAction(event -> viewInputEventHandler.accept(SessionPlannerMainViewInputEvent.moveEncounterDown(encounter.token())));

        Button remove = new Button("Entfernen");
        remove.getStyleClass().addAll("compact", "flat");
        remove.setOnAction(event -> viewInputEventHandler.accept(SessionPlannerMainViewInputEvent.removeEncounter(encounter.token())));

        HBox actions = new HBox(6, up, down, remove);
        VBox card = new VBox(6, title, meta, budget, multiplier, actions);
        card.getStyleClass().add("session-planner-encounter-card");
        card.setPadding(new Insets(10));
        return card;
    }

    private VBox restGapCard(SessionPlannerContributionModel.RestGapModel gap, int leftEncounter, int rightEncounter) {
        Label title = new Label("Zwischen Encounter " + leftEncounter + " und " + rightEncounter);
        title.getStyleClass().add("session-planner-gap-title");
        Label current = new Label(gap.label());
        current.getStyleClass().add(gap.hasAssignedRest()
                ? "session-planner-gap-active"
                : "text-secondary");

        Button shortRest = new Button("Kurze Rast");
        shortRest.getStyleClass().addAll("compact", "flat");
        shortRest.setOnAction(event -> viewInputEventHandler.accept(SessionPlannerMainViewInputEvent.setShortRest(gap.gapIndex())));

        Button longRest = new Button("Lange Rast");
        longRest.getStyleClass().addAll("compact", "flat");
        longRest.setOnAction(event -> viewInputEventHandler.accept(SessionPlannerMainViewInputEvent.setLongRest(gap.gapIndex())));

        Button clear = new Button("Leeren");
        clear.getStyleClass().addAll("compact", "flat");
        clear.setDisable(!gap.hasAssignedRest());
        clear.setOnAction(event -> viewInputEventHandler.accept(SessionPlannerMainViewInputEvent.clearRest(gap.gapIndex())));

        HBox actions = new HBox(6, shortRest, longRest, clear);
        VBox card = new VBox(6, title, current, actions);
        card.getStyleClass().add("session-planner-gap-card");
        card.setPadding(new Insets(8, 10, 8, 10));
        return card;
    }

    private HBox lootCard(SessionPlannerContributionModel.LootModel loot) {
        Label label = new Label(loot.label());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Button remove = new Button("Entfernen");
        remove.getStyleClass().addAll("compact", "flat");
        remove.setOnAction(event -> viewInputEventHandler.accept(SessionPlannerMainViewInputEvent.removeLootPlaceholder(loot.token())));
        HBox row = new HBox(8, label, spacer, remove);
        row.setAlignment(Pos.CENTER_LEFT);
        row.getStyleClass().add("session-planner-loot-card");
        row.setPadding(new Insets(8, 10, 8, 10));
        return row;
    }
}
