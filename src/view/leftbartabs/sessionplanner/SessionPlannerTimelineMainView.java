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

    private final TimelineSection timelineSection = new TimelineSection();
    private List<SessionPlannerContributionModel.EncounterModel> encounters = List.of();
    private List<SessionPlannerContributionModel.RestGapModel> gaps = List.of();
    private Consumer<SessionPlannerTimelineMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerTimelineMainView() {
        getStyleClass().add("session-planner-main");
        getChildren().add(timelineSection);
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

    private void renderTimeline() {
        timelineSection.show(encounters, gaps, this::publish);
    }

    private void publish(SessionPlannerTimelineMainViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private static final class TimelineSection extends VBox {

        private final TimelineRows rows = new TimelineRows();

        private TimelineSection() {
            super(8);
            getChildren().addAll(new SectionHeader("Abenteuerablauf"), rows);
        }

        private void show(
                List<SessionPlannerContributionModel.EncounterModel> encounters,
                List<SessionPlannerContributionModel.RestGapModel> gaps,
                Consumer<SessionPlannerTimelineMainViewInputEvent> publisher
        ) {
            rows.show(encounters, gaps, publisher);
        }
    }

    private static final class TimelineRows extends VBox {

        private final EmptyTimelineLabel emptyLabel = new EmptyTimelineLabel();

        private TimelineRows() {
            super(8);
        }

        private void show(
                List<SessionPlannerContributionModel.EncounterModel> encounters,
                List<SessionPlannerContributionModel.RestGapModel> gaps,
                Consumer<SessionPlannerTimelineMainViewInputEvent> publisher
        ) {
            getChildren().clear();
            if (encounters.isEmpty()) {
                getChildren().add(emptyLabel);
                return;
            }
            for (int index = 0; index < encounters.size(); index++) {
                SessionPlannerContributionModel.EncounterModel encounter = encounters.get(index);
                getChildren().add(new EncounterCard(encounter, index + 1, publisher));
                if (index < gaps.size()) {
                    getChildren().add(new RestGapCard(gaps.get(index), index + 1, index + 2, publisher));
                }
            }
        }
    }

    private static final class EncounterCard extends VBox {

        private EncounterCard(
                SessionPlannerContributionModel.EncounterModel encounter,
                int position,
                Consumer<SessionPlannerTimelineMainViewInputEvent> publisher
        ) {
            super(6);
            Label title = new StyledLabel(position + ". " + encounter.name(), "session-planner-encounter-title");
            Label meta = new StyledLabel(encounter.creatureCount() + " Kreaturen"
                    + generatedLabelSuffix(encounter), STYLE_TEXT_SECONDARY);
            Label budget = new StyledLabel(encounter.budgetPercentageText()
                    + " Budget · Ziel " + encounter.targetXpText() + " XP", "session-planner-encounter-budget");
            Label comparison = new StyledLabel(
                    encounter.comparisonText() + " · " + encounter.difficultyLabel(),
                    STYLE_TEXT_SECONDARY);
            Label multiplier = new StyledLabel(
                    "Base " + encounter.totalBaseXp()
                            + " XP · Multiplikator x"
                            + String.format(java.util.Locale.US, "%.2f", encounter.xpMultiplier()),
                    STYLE_TEXT_SECONDARY);
            Label stateHint = encounter.selected()
                    ? new StyledLabel("Dieser Encounter speist aktuell das State-Panel.", "session-planner-gap-active")
                    : new StyledLabel(
                            "Wird im State-Panel sichtbar, sobald er ausgewaehlt ist.",
                            STYLE_TEXT_SECONDARY);

            Button select = new ActionButton(
                    encounter.selected() ? "Ausgewaehlt" : "Auswaehlen",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.SELECT_ENCOUNTER, encounter.token(), -1),
                    encounter.selected() ? STYLE_FLAT : "accent");
            select.setDisable(encounter.selected());

            Button decreaseAllocation = new ActionButton(
                    "-10%",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.DECREASE_ALLOCATION, encounter.token(), -1),
                    STYLE_FLAT);
            Button increaseAllocation = new ActionButton(
                    "+10%",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.INCREASE_ALLOCATION, encounter.token(), -1),
                    STYLE_FLAT);

            Button up = new ActionButton(
                    "Hoch",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.MOVE_ENCOUNTER_UP, encounter.token(), -1),
                    STYLE_FLAT);
            up.setDisable(!encounter.canMoveUp());

            Button down = new ActionButton(
                    "Runter",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.MOVE_ENCOUNTER_DOWN, encounter.token(), -1),
                    STYLE_FLAT);
            down.setDisable(!encounter.canMoveDown());

            Button remove = new ActionButton(
                    "Entfernen",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.REMOVE_ENCOUNTER, encounter.token(), -1),
                    STYLE_FLAT);

            bind(select, publisher);
            bind(decreaseAllocation, publisher);
            bind(increaseAllocation, publisher);
            bind(up, publisher);
            bind(down, publisher);
            bind(remove, publisher);

            getChildren().addAll(
                    title,
                    meta,
                    budget,
                    comparison,
                    multiplier,
                    stateHint,
                    new ActionRow(select, decreaseAllocation, increaseAllocation),
                    new ActionRow(up, down, remove));
            getStyleClass().add("session-planner-encounter-card");
            setPadding(new Insets(10));
        }

        private static String generatedLabelSuffix(SessionPlannerContributionModel.EncounterModel encounter) {
            return encounter.generatedLabel().isBlank() ? "" : " · " + encounter.generatedLabel();
        }
    }

    private static final class RestGapCard extends VBox {

        private RestGapCard(
                SessionPlannerContributionModel.RestGapModel gap,
                int leftEncounter,
                int rightEncounter,
                Consumer<SessionPlannerTimelineMainViewInputEvent> publisher
        ) {
            super(6);
            Label title = new StyledLabel(
                    "Zwischen Encounter " + leftEncounter + " und " + rightEncounter,
                    "session-planner-gap-title");
            Label current = new StyledLabel(
                    gap.label(),
                    gap.hasAssignedRest() ? "session-planner-gap-active" : STYLE_TEXT_SECONDARY);

            Button shortRest = new ActionButton(
                    "Kurze Rast",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.SET_SHORT_REST, 0L, gap.gapIndex()),
                    STYLE_FLAT);
            Button longRest = new ActionButton(
                    "Lange Rast",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.SET_LONG_REST, 0L, gap.gapIndex()),
                    STYLE_FLAT);
            Button clear = new ActionButton(
                    "Leeren",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.CLEAR_REST, 0L, gap.gapIndex()),
                    STYLE_FLAT);
            clear.setDisable(!gap.hasAssignedRest());

            bind(shortRest, publisher);
            bind(longRest, publisher);
            bind(clear, publisher);

            getChildren().addAll(title, current, new ActionRow(shortRest, longRest, clear));
            getStyleClass().add("session-planner-gap-card");
            setPadding(new Insets(8, 10, 8, 10));
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class SectionHeader extends StyledLabel {

        private SectionHeader(String text) {
            super(text, "section-header", "text-muted");
        }
    }

    private static final class EmptyTimelineLabel extends StyledLabel {

        private EmptyTimelineLabel() {
            super("Noch keine Encounter importiert.", STYLE_TEXT_SECONDARY, "session-planner-empty");
        }
    }

    private static final class ActionButton extends Button {

        private final SessionPlannerTimelineMainViewInputEvent event;

        private ActionButton(
                String text,
                SessionPlannerTimelineMainViewInputEvent event,
                String emphasisStyle
        ) {
            super(text);
            this.event = event;
            getStyleClass().addAll(STYLE_COMPACT, emphasisStyle);
        }
    }

    private static final class ActionRow extends HBox {

        private ActionRow(Button... actions) {
            super(6);
            getChildren().addAll(actions);
        }
    }

    private static void bind(
            ActionButton button,
            Consumer<SessionPlannerTimelineMainViewInputEvent> publisher
    ) {
        button.setOnAction(ignored -> publisher.accept(button.event));
    }

    private static SessionPlannerTimelineMainViewInputEvent event(
            SessionPlannerTimelineMainViewInputEvent.Kind kind,
            long encounterToken,
            int gapIndex
    ) {
        return new SessionPlannerTimelineMainViewInputEvent(kind, encounterToken, gapIndex);
    }
}
