package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

public final class SessionPlannerTimelineMainView extends VBox {

    private static final BigDecimal ALLOCATION_STEP = BigDecimal.TEN;
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_FLAT = "flat";

    private final TimelineSection timelineSection = new TimelineSection();
    private List<MainProjection.EncounterModel> encounters = List.of();
    private List<MainProjection.RestGapModel> gaps = List.of();
    private Consumer<SessionPlannerTimelineMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerTimelineMainView() {
        getStyleClass().add("session-planner-main");
        getChildren().add(timelineSection);
    }

    public void show(MainProjection projection) {
        MainProjection safe = projection == null ? MainProjection.empty() : projection;
        encounters = safe.encounters();
        gaps = safe.restGaps();
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
                List<MainProjection.EncounterModel> encounters,
                List<MainProjection.RestGapModel> gaps,
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
                List<MainProjection.EncounterModel> encounters,
                List<MainProjection.RestGapModel> gaps,
                Consumer<SessionPlannerTimelineMainViewInputEvent> publisher
        ) {
            getChildren().clear();
            if (encounters.isEmpty()) {
                getChildren().add(emptyLabel);
                return;
            }
            for (int index = 0; index < encounters.size(); index++) {
                MainProjection.EncounterModel encounter = encounters.get(index);
                getChildren().add(new EncounterCard(encounter, index + 1, publisher));
                if (index < gaps.size()) {
                    getChildren().add(new RestGapCard(gaps.get(index), index + 1, index + 2, publisher));
                }
            }
        }
    }

    private static final class EncounterCard extends VBox {

        private EncounterCard(
                MainProjection.EncounterModel encounter,
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

            ActionButton select = new ActionButton(
                    encounter.selected() ? "Ausgewaehlt" : "Auswaehlen",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.SELECT_ENCOUNTER, encounter.token()),
                    encounter.selected() ? STYLE_FLAT : "accent");
            select.setDisable(encounter.selected());

            ActionButton decreaseAllocation = new ActionButton(
                    "-10%",
                    allocationEvent(encounter, ALLOCATION_STEP.negate()),
                    STYLE_FLAT);
            ActionButton increaseAllocation = new ActionButton(
                    "+10%",
                    allocationEvent(encounter, ALLOCATION_STEP),
                    STYLE_FLAT);

            ActionButton up = new ActionButton(
                    "Hoch",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.MOVE_ENCOUNTER_UP, encounter.token()),
                    STYLE_FLAT);
            up.setDisable(!encounter.canMoveUp());

            ActionButton down = new ActionButton(
                    "Runter",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.MOVE_ENCOUNTER_DOWN, encounter.token()),
                    STYLE_FLAT);
            down.setDisable(!encounter.canMoveDown());

            ActionButton remove = new ActionButton(
                    "Entfernen",
                    event(SessionPlannerTimelineMainViewInputEvent.Kind.REMOVE_ENCOUNTER, encounter.token()),
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

        private static String generatedLabelSuffix(MainProjection.EncounterModel encounter) {
            return encounter.generatedLabel().isBlank() ? "" : " · " + encounter.generatedLabel();
        }
    }

    private static final class RestGapCard extends VBox {

        private RestGapCard(
                MainProjection.RestGapModel gap,
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

            ActionButton shortRest = new ActionButton(
                    "Kurze Rast",
                    restEvent(
                            SessionPlannerTimelineMainViewInputEvent.Kind.SET_SHORT_REST,
                            gap.leftEncounterId(),
                            gap.rightEncounterId()),
                    STYLE_FLAT);
            ActionButton longRest = new ActionButton(
                    "Lange Rast",
                    restEvent(
                            SessionPlannerTimelineMainViewInputEvent.Kind.SET_LONG_REST,
                            gap.leftEncounterId(),
                            gap.rightEncounterId()),
                    STYLE_FLAT);
            ActionButton clear = new ActionButton(
                    "Leeren",
                    restEvent(
                            SessionPlannerTimelineMainViewInputEvent.Kind.CLEAR_REST,
                            gap.leftEncounterId(),
                            gap.rightEncounterId()),
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

    private static class StyledLabel extends Label {

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
            long encounterToken
    ) {
        return new SessionPlannerTimelineMainViewInputEvent(kind, encounterToken, BigDecimal.ZERO, 0L, 0L);
    }

    private static SessionPlannerTimelineMainViewInputEvent allocationEvent(
            MainProjection.EncounterModel encounter,
            BigDecimal allocationDelta
    ) {
        return new SessionPlannerTimelineMainViewInputEvent(
                SessionPlannerTimelineMainViewInputEvent.Kind.SET_ENCOUNTER_ALLOCATION,
                encounter.token(),
                encounter.budgetPercentage().add(allocationDelta),
                0L,
                0L);
    }

    private static SessionPlannerTimelineMainViewInputEvent restEvent(
            SessionPlannerTimelineMainViewInputEvent.Kind kind,
            long leftEncounterId,
            long rightEncounterId
    ) {
        return new SessionPlannerTimelineMainViewInputEvent(
                kind,
                0L,
                BigDecimal.ZERO,
                leftEncounterId,
                rightEncounterId);
    }
}
