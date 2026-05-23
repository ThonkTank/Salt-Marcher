package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

public final class SessionPlannerTimelineMainView extends ScrollPane {

    private static final BigDecimal ALLOCATION_STEP = BigDecimal.TEN;
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_FLAT = "flat";
    private static final String REST_NONE = "NONE";
    private static final String REST_SHORT = "SHORT_REST";
    private static final String REST_LONG = "LONG_REST";

    private final VBox rows = new VBox(8);
    private final VBox lootRows = new VBox(6);
    private Consumer<SessionPlannerTimelineMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerTimelineMainView() {
        VBox content = new VBox(
                12,
                label("Abenteuerablauf", "section-header", "text-muted"),
                rows,
                lootHeader(),
                lootRows);
        addStyles(content, "session-planner-main");
        setContent(content);
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    }

    public void onViewInputEvent(Consumer<SessionPlannerTimelineMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(SessionPlannerTimelineMainContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        contentModel.projectionProperty().addListener((ignored, before, after) -> show(after));
        show(contentModel.projectionProperty().get());
    }

    private void show(SessionPlannerTimelineMainContentModel.Projection projection) {
        if (projection == null) {
            return;
        }
        clearNodes(rows);
        showLoot(projection.lootPlaceholders(), projection.lootEmptyMessage());
        if (projection.encounters().isEmpty()) {
            addNode(rows, label("Noch keine Encounter importiert.", STYLE_TEXT_SECONDARY, "session-planner-empty"));
            return;
        }
        for (int index = 0; index < projection.encounters().size(); index++) {
            SessionPlannerTimelineMainContentModel.Projection.EncounterModel encounter = projection.encounters().get(index);
            addNode(rows, encounterCard(encounter, index + 1));
            if (index < projection.restGaps().size()) {
                addNode(rows, restGapCard(projection.restGaps().get(index), index + 1, index + 2));
            }
        }
    }

    private Node encounterCard(
            SessionPlannerTimelineMainContentModel.Projection.EncounterModel encounter,
            int position
    ) {
        Label title = label(position + ". " + encounter.name(), "session-planner-encounter-title");
        Label meta = label(encounter.creatureCount() + " Kreaturen" + generatedLabelSuffix(encounter), STYLE_TEXT_SECONDARY);
        Label budget = label(
                encounter.budgetPercentageText() + " Budget · Ziel " + encounter.targetXpText() + " XP",
                "session-planner-encounter-budget");
        Label comparison = label(encounter.comparisonText() + " · " + encounter.difficultyLabel(), STYLE_TEXT_SECONDARY);
        Label multiplier = label(
                "Base " + encounter.totalBaseXp()
                        + " XP · Multiplikator x"
                        + String.format(Locale.US, "%.2f", encounter.xpMultiplier()),
                STYLE_TEXT_SECONDARY);
        Label stateHint = label(
                encounter.selected()
                        ? "Dieser Encounter speist aktuell das State-Panel."
                        : "Wird im State-Panel sichtbar, sobald er ausgewaehlt ist.",
                encounter.selected() ? "session-planner-gap-active" : STYLE_TEXT_SECONDARY);

        Button select = actionButton(
                encounter.selected() ? "Ausgewaehlt" : "Auswaehlen",
                this::publishSelection,
                encounter.selected() ? STYLE_FLAT : "accent");
        select.setUserData(Long.valueOf(encounter.token()));
        select.setDisable(encounter.selected());

        Button decreaseAllocation = actionButton("-10%", this::publishAllocation, STYLE_FLAT);
        decreaseAllocation.setUserData(new Object[] {
                Long.valueOf(encounter.token()),
                encounter.budgetPercentage().subtract(ALLOCATION_STEP)
        });
        Button increaseAllocation = actionButton("+10%", this::publishAllocation, STYLE_FLAT);
        increaseAllocation.setUserData(new Object[] {
                Long.valueOf(encounter.token()),
                encounter.budgetPercentage().add(ALLOCATION_STEP)
        });

        Button up = actionButton("Hoch", this::publishMove, STYLE_FLAT);
        up.setUserData(new Object[] {Long.valueOf(encounter.token()), Integer.valueOf(-1)});
        up.setDisable(!encounter.canMoveUp());

        Button down = actionButton("Runter", this::publishMove, STYLE_FLAT);
        down.setUserData(new Object[] {Long.valueOf(encounter.token()), Integer.valueOf(1)});
        down.setDisable(!encounter.canMoveDown());

        Button remove = actionButton("Entfernen", this::publishRemoval, STYLE_FLAT);
        remove.setUserData(Long.valueOf(encounter.token()));

        VBox card = new VBox(6,
                title,
                meta,
                budget,
                comparison,
                multiplier,
                stateHint,
                actionRow(select, decreaseAllocation, increaseAllocation),
                actionRow(up, down, remove));
        addStyles(card, "session-planner-encounter-card");
        return card;
    }

    private Node lootHeader() {
        Button addButton = actionButton("Loot-Platzhalter", this::publishAddLoot, "accent");
        return new ActionRow(8, label("Loot-Platzhalter", "section-header", "text-muted"), addButton);
    }

    private void showLoot(
            List<SessionPlannerTimelineMainContentModel.Projection.LootModel> lootPlaceholders,
            String emptyMessage
    ) {
        clearNodes(lootRows);
        if (lootPlaceholders.isEmpty()) {
            addNode(lootRows, label(emptyMessage, STYLE_TEXT_SECONDARY, "session-planner-empty"));
            return;
        }
        for (SessionPlannerTimelineMainContentModel.Projection.LootModel loot : lootPlaceholders) {
            addNode(lootRows, lootCard(loot));
        }
    }

    private Node lootCard(SessionPlannerTimelineMainContentModel.Projection.LootModel loot) {
        Label label = label(loot.label());
        Button remove = actionButton("Entfernen", this::publishRemoveLoot, STYLE_FLAT);
        remove.setUserData(Long.valueOf(loot.token()));
        ActionRow row = new ActionRow(8, label, remove);
        row.addStyles("session-planner-loot-card");
        return row;
    }

    private Node restGapCard(
            SessionPlannerTimelineMainContentModel.Projection.RestGapModel gap,
            int leftEncounter,
            int rightEncounter
    ) {
        Label title = label(
                "Zwischen Encounter " + leftEncounter + " und " + rightEncounter,
                "session-planner-gap-title");
        Label current = label(gap.label(), gap.hasAssignedRest() ? "session-planner-gap-active" : STYLE_TEXT_SECONDARY);

        Button shortRest = actionButton("Kurze Rast", this::publishRestGap, STYLE_FLAT);
        shortRest.setUserData(new Object[] {
                Long.valueOf(gap.leftEncounterId()),
                Long.valueOf(gap.rightEncounterId()),
                REST_SHORT
        });
        Button longRest = actionButton("Lange Rast", this::publishRestGap, STYLE_FLAT);
        longRest.setUserData(new Object[] {
                Long.valueOf(gap.leftEncounterId()),
                Long.valueOf(gap.rightEncounterId()),
                REST_LONG
        });
        Button clear = actionButton("Leeren", this::publishRestGap, STYLE_FLAT);
        clear.setUserData(new Object[] {
                Long.valueOf(gap.leftEncounterId()),
                Long.valueOf(gap.rightEncounterId()),
                REST_NONE
        });
        clear.setDisable(!gap.hasAssignedRest());

        VBox card = new VBox(6, title, current, actionRow(shortRest, longRest, clear));
        addStyles(card, "session-planner-gap-card");
        return card;
    }

    private void publishSelection(ActionEvent event) {
        long token = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number value) {
            token = value.longValue();
        }
        publish(new SessionPlannerTimelineMainViewInputEvent(
                token,
                0L,
                BigDecimal.ZERO,
                0L,
                0,
                0L,
                0L,
                0L,
                "",
                false,
                0L));
    }

    private void publishAllocation(ActionEvent event) {
        long token = 0L;
        BigDecimal allocation = BigDecimal.ZERO;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Object[] payload) {
            if (payload.length > 0 && payload[0] instanceof Number value) {
                token = value.longValue();
            }
            if (payload.length > 1 && payload[1] instanceof BigDecimal value) {
                allocation = value;
            }
        }
        publish(new SessionPlannerTimelineMainViewInputEvent(
                0L,
                token,
                allocation,
                0L,
                0,
                0L,
                0L,
                0L,
                "",
                false,
                0L));
    }

    private void publishMove(ActionEvent event) {
        long token = 0L;
        int direction = 0;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Object[] payload) {
            if (payload.length > 0 && payload[0] instanceof Number value) {
                token = value.longValue();
            }
            if (payload.length > 1 && payload[1] instanceof Number value) {
                direction = value.intValue();
            }
        }
        publish(new SessionPlannerTimelineMainViewInputEvent(
                0L,
                0L,
                BigDecimal.ZERO,
                token,
                direction,
                0L,
                0L,
                0L,
                "",
                false,
                0L));
    }

    private void publishRemoval(ActionEvent event) {
        long token = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number value) {
            token = value.longValue();
        }
        publish(new SessionPlannerTimelineMainViewInputEvent(
                0L,
                0L,
                BigDecimal.ZERO,
                0L,
                0,
                token,
                0L,
                0L,
                "",
                false,
                0L));
    }

    private void publishRestGap(ActionEvent event) {
        long left = 0L;
        long right = 0L;
        String restSelection = "";
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Object[] payload) {
            if (payload.length > 0 && payload[0] instanceof Number value) {
                left = value.longValue();
            }
            if (payload.length > 1 && payload[1] instanceof Number value) {
                right = value.longValue();
            }
            if (payload.length > 2 && payload[2] instanceof String value) {
                restSelection = value;
            }
        }
        publish(new SessionPlannerTimelineMainViewInputEvent(
                0L,
                0L,
                BigDecimal.ZERO,
                0L,
                0,
                0L,
                left,
                right,
                restSelection,
                false,
                0L));
    }

    private void publishAddLoot(ActionEvent event) {
        publish(new SessionPlannerTimelineMainViewInputEvent(
                0L,
                0L,
                BigDecimal.ZERO,
                0L,
                0,
                0L,
                0L,
                0L,
                "",
                true,
                0L));
    }

    private void publishRemoveLoot(ActionEvent event) {
        long lootToken = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number token) {
            lootToken = token.longValue();
        }
        publish(new SessionPlannerTimelineMainViewInputEvent(
                0L,
                0L,
                BigDecimal.ZERO,
                0L,
                0,
                0L,
                0L,
                0L,
                "",
                false,
                lootToken));
    }

    private void publish(SessionPlannerTimelineMainViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private static String generatedLabelSuffix(
            SessionPlannerTimelineMainContentModel.Projection.EncounterModel encounter
    ) {
        return encounter.generatedLabel().isBlank() ? "" : " · " + encounter.generatedLabel();
    }

    private static Label label(String text, String... styleClasses) {
        return new StyledLabel(text, styleClasses);
    }

    private static Button actionButton(String text, EventHandler<ActionEvent> action, String emphasisStyle) {
        Button button = new StyledButton(text, STYLE_COMPACT, emphasisStyle);
        button.setOnAction(action);
        return button;
    }

    private static HBox actionRow(Button... actions) {
        return new ActionRow(6, actions);
    }

    private static void clearNodes(VBox box) {
        box.getChildren().clear();
    }

    private static void addNode(VBox box, Node child) {
        box.getChildren().add(child);
    }

    private static void addStyles(Node node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
    }

    private static final class ActionRow extends HBox {

        private ActionRow(double spacing, Node... actions) {
            super(spacing, actions);
            setAlignment(Pos.CENTER_LEFT);
        }

        private void addStyles(String... styleClasses) {
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class StyledButton extends Button {

        private StyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }
}
