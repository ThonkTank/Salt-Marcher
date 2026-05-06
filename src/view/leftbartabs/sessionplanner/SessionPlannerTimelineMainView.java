package src.view.leftbartabs.sessionplanner;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

public final class SessionPlannerTimelineMainView extends VBox {

    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_FLAT = "flat";

    private final VBox timelineBox = new VBox(8);
    private final Label emptyTimelineLabel = new Label("Noch keine Encounter importiert.");
    private List<SessionPlannerContributionModel.EncounterModel> encounters = List.of();
    private List<SessionPlannerContributionModel.RestGapModel> gaps = List.of();
    private Consumer<SessionPlannerTimelineMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerTimelineMainView() {
        getStyleClass().add("session-planner-main");
        getChildren().add(timelineSection());
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

    public void onViewInputEvent(Consumer<SessionPlannerTimelineMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private VBox timelineSection() {
        Label header = new Label("Abenteuerablauf");
        header.getStyleClass().addAll("section-header", "text-muted");
        return new VBox(8, header, timelineBox);
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
        meta.getStyleClass().add(STYLE_TEXT_SECONDARY);
        Label budget = new Label(encounter.budgetPercentageText()
                + " Budget · Ziel " + encounter.targetXpText() + " XP");
        budget.getStyleClass().add("session-planner-encounter-budget");
        Label comparison = new Label(encounter.comparisonText() + " · " + encounter.difficultyLabel());
        comparison.getStyleClass().add(STYLE_TEXT_SECONDARY);
        Label multiplier = new Label("Base " + encounter.totalBaseXp()
                + " XP · Multiplikator x" + String.format(java.util.Locale.US, "%.2f", encounter.xpMultiplier()));
        multiplier.getStyleClass().add(STYLE_TEXT_SECONDARY);

        Button select = new Button(encounter.selected() ? "Ausgewaehlt" : "Auswaehlen");
        select.getStyleClass().addAll(STYLE_COMPACT, encounter.selected() ? STYLE_FLAT : "accent");
        select.setDisable(encounter.selected());
        select.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerTimelineMainViewInputEvent(
                        SessionPlannerTimelineMainViewInputEvent.Kind.SELECT_ENCOUNTER,
                        encounter.token(),
                        -1)));

        Button decreaseAllocation = new Button("-10%");
        decreaseAllocation.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT);
        decreaseAllocation.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerTimelineMainViewInputEvent(
                        SessionPlannerTimelineMainViewInputEvent.Kind.DECREASE_ALLOCATION,
                        encounter.token(),
                        -1)));

        Button increaseAllocation = new Button("+10%");
        increaseAllocation.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT);
        increaseAllocation.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerTimelineMainViewInputEvent(
                        SessionPlannerTimelineMainViewInputEvent.Kind.INCREASE_ALLOCATION,
                        encounter.token(),
                        -1)));

        Button up = new Button("Hoch");
        up.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT);
        up.setDisable(!encounter.canMoveUp());
        up.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerTimelineMainViewInputEvent(
                        SessionPlannerTimelineMainViewInputEvent.Kind.MOVE_ENCOUNTER_UP,
                        encounter.token(),
                        -1)));

        Button down = new Button("Runter");
        down.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT);
        down.setDisable(!encounter.canMoveDown());
        down.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerTimelineMainViewInputEvent(
                        SessionPlannerTimelineMainViewInputEvent.Kind.MOVE_ENCOUNTER_DOWN,
                        encounter.token(),
                        -1)));

        Button remove = new Button("Entfernen");
        remove.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT);
        remove.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerTimelineMainViewInputEvent(
                        SessionPlannerTimelineMainViewInputEvent.Kind.REMOVE_ENCOUNTER,
                        encounter.token(),
                        -1)));

        HBox primaryActions = new HBox(6, select, decreaseAllocation, increaseAllocation);
        HBox secondaryActions = new HBox(6, up, down, remove);
        Label stateHint = new Label(encounter.selected()
                ? "Dieser Encounter speist aktuell das State-Panel."
                : "Wird im State-Panel sichtbar, sobald er ausgewaehlt ist.");
        stateHint.getStyleClass().add(encounter.selected()
                ? "session-planner-gap-active"
                : STYLE_TEXT_SECONDARY);
        VBox card = new VBox(6, title, meta, budget, comparison, multiplier, stateHint, primaryActions, secondaryActions);
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
                : STYLE_TEXT_SECONDARY);

        Button shortRest = new Button("Kurze Rast");
        shortRest.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT);
        shortRest.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerTimelineMainViewInputEvent(
                        SessionPlannerTimelineMainViewInputEvent.Kind.SET_SHORT_REST,
                        0L,
                        gap.gapIndex())));

        Button longRest = new Button("Lange Rast");
        longRest.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT);
        longRest.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerTimelineMainViewInputEvent(
                        SessionPlannerTimelineMainViewInputEvent.Kind.SET_LONG_REST,
                        0L,
                        gap.gapIndex())));

        Button clear = new Button("Leeren");
        clear.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT);
        clear.setDisable(!gap.hasAssignedRest());
        clear.setOnAction(event -> viewInputEventHandler.accept(
                new SessionPlannerTimelineMainViewInputEvent(
                        SessionPlannerTimelineMainViewInputEvent.Kind.CLEAR_REST,
                        0L,
                        gap.gapIndex())));

        HBox actions = new HBox(6, shortRest, longRest, clear);
        VBox card = new VBox(6, title, current, actions);
        card.getStyleClass().add("session-planner-gap-card");
        card.setPadding(new Insets(8, 10, 8, 10));
        return card;
    }
}
