package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;
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
    private Consumer<SessionPlannerViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerTimelineMainView() {
        getStyleClass().add("session-planner-main");
        getChildren().add(timelineSection);
    }

    public void onViewInputEvent(Consumer<SessionPlannerViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(SessionPlannerContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        contributionModel.mainProjectionProperty().addListener((ignored, before, after) -> show(after));
        show(contributionModel.mainProjectionProperty().get());
    }

    private void show(MainProjection projection) {
        MainProjection safe = projection == null ? MainProjection.empty() : projection;
        timelineSection.show(safe.encounters(), safe.restGaps(), this::publish);
    }

    private void publish(SessionPlannerViewInputEvent event) {
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
                Consumer<SessionPlannerViewInputEvent> publisher
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
                Consumer<SessionPlannerViewInputEvent> publisher
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
                Consumer<SessionPlannerViewInputEvent> publisher
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
                    () -> selectEncounterEvent(encounter.token()),
                    encounter.selected() ? STYLE_FLAT : "accent");
            select.setDisable(encounter.selected());

            ActionButton decreaseAllocation = new ActionButton(
                    "-10%",
                    () -> allocationEvent(encounter, ALLOCATION_STEP.negate()),
                    STYLE_FLAT);
            ActionButton increaseAllocation = new ActionButton(
                    "+10%",
                    () -> allocationEvent(encounter, ALLOCATION_STEP),
                    STYLE_FLAT);

            ActionButton up = new ActionButton(
                    "Hoch",
                    () -> moveEvent(encounter.token(), SessionPlannerDirection.UP),
                    STYLE_FLAT);
            up.setDisable(!encounter.canMoveUp());

            ActionButton down = new ActionButton(
                    "Runter",
                    () -> moveEvent(encounter.token(), SessionPlannerDirection.DOWN),
                    STYLE_FLAT);
            down.setDisable(!encounter.canMoveDown());

            ActionButton remove = new ActionButton(
                    "Entfernen",
                    () -> removeEncounterEvent(encounter.token()),
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
                Consumer<SessionPlannerViewInputEvent> publisher
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
                    () -> restEvent(
                            gap.leftEncounterId(),
                            gap.rightEncounterId(),
                            SessionPlannerRestSelection.SHORT_REST),
                    STYLE_FLAT);
            ActionButton longRest = new ActionButton(
                    "Lange Rast",
                    () -> restEvent(
                            gap.leftEncounterId(),
                            gap.rightEncounterId(),
                            SessionPlannerRestSelection.LONG_REST),
                    STYLE_FLAT);
            ActionButton clear = new ActionButton(
                    "Leeren",
                    () -> restEvent(
                            gap.leftEncounterId(),
                            gap.rightEncounterId(),
                            SessionPlannerRestSelection.NONE),
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

        private final Supplier<SessionPlannerViewInputEvent> eventSupplier;

        private ActionButton(
                String text,
                Supplier<SessionPlannerViewInputEvent> eventSupplier,
                String emphasisStyle
        ) {
            super(text);
            this.eventSupplier = eventSupplier;
            getStyleClass().addAll(STYLE_COMPACT, emphasisStyle);
        }

        private void bindTo(Consumer<SessionPlannerViewInputEvent> publisher) {
            setOnAction(ignored -> publisher.accept(eventSupplier.get()));
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
            Consumer<SessionPlannerViewInputEvent> publisher
    ) {
        button.bindTo(publisher);
    }

    private static SessionPlannerViewInputEvent selectEncounterEvent(long encounterToken) {
        return new SessionPlannerViewInputEvent(
                new SessionPlannerViewInputEvent.EncounterActionInput(
                        SessionPlannerEncounterAction.SELECT,
                        new SessionPlannerEncounterRef(encounterToken)));
    }

    private static SessionPlannerViewInputEvent moveEvent(
            long encounterToken,
            SessionPlannerDirection direction
    ) {
        return new SessionPlannerViewInputEvent(
                new SessionPlannerViewInputEvent.MoveEncounterInput(
                        new SessionPlannerMoveChange(new SessionPlannerEncounterRef(encounterToken), direction)));
    }

    private static SessionPlannerViewInputEvent removeEncounterEvent(long encounterToken) {
        return new SessionPlannerViewInputEvent(
                new SessionPlannerViewInputEvent.EncounterActionInput(
                        SessionPlannerEncounterAction.REMOVE,
                        new SessionPlannerEncounterRef(encounterToken)));
    }

    private static SessionPlannerViewInputEvent allocationEvent(
            MainProjection.EncounterModel encounter,
            BigDecimal allocationDelta
    ) {
        return new SessionPlannerViewInputEvent(
                new SessionPlannerViewInputEvent.EncounterAllocationInput(
                        new SessionPlannerEncounterAllocationChange(
                                new SessionPlannerEncounterRef(encounter.token()),
                                encounter.budgetPercentage().add(allocationDelta))));
    }

    private static SessionPlannerViewInputEvent restEvent(
            long leftEncounterId,
            long rightEncounterId,
            SessionPlannerRestSelection restSelection
    ) {
        return new SessionPlannerViewInputEvent(
                new SessionPlannerViewInputEvent.RestGapInput(
                        new SessionPlannerRestGapChange(
                                new SessionPlannerRestGapRef(leftEncounterId, rightEncounterId),
                                restSelection)));
    }
}
