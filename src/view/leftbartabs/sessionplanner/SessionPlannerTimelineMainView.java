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
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

public final class SessionPlannerTimelineMainView extends ScrollPane {

    private static final BigDecimal ALLOCATION_STEP = BigDecimal.TEN;
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_ACCENT = "accent";
    private static final String STYLE_FLAT = "flat";
    private final VBox content = new VBox(12);
    private final VBox rows = new VBox(8);
    private Consumer<SessionPlannerTimelineMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public SessionPlannerTimelineMainView() {
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
        content.getChildren().setAll(setupBox(projection.setup()), rows);
        if (projection.scenes().isEmpty()) {
            addNode(rows, label("Noch keine Szenen.", STYLE_TEXT_SECONDARY, "session-planner-empty"));
        } else {
            for (int index = 0; index < projection.scenes().size(); index++) {
                SessionPlannerTimelineMainContentModel.Projection.SceneModel scene =
                        projection.scenes().get(index);
                addNode(rows, sceneCard(scene, index + 1));
                if (index < projection.restGaps().size()) {
                    addNode(rows, restGapCard(projection.restGaps().get(index), index + 1, index + 2));
                }
            }
        }
        Button addScene = actionButton("Szene hinzufuegen", ignored -> publishAddScene(), STYLE_ACCENT);
        addScene.setDisable(projection.setup().sessionActionsDisabled());
        addNode(rows, addScene);
    }

    private Node setupBox(SessionPlannerTimelineMainContentModel.Projection.SetupModel setup) {
        ComboBox<String> partyMemberSelector = new ComboBox<>();
        partyMemberSelector.getItems().setAll(setup.partyMemberChoiceLabels());
        partyMemberSelector.setPromptText("Spieler");
        if (!partyMemberSelector.getItems().isEmpty()) {
            partyMemberSelector.getSelectionModel().selectFirst();
        }
        partyMemberSelector.setDisable(setup.sessionActionsDisabled() || partyMemberSelector.getItems().isEmpty());
        Button addPlayer = actionButton(
                "Hinzufuegen",
                ignored -> publishParticipantAdd(partyMemberSelector),
                STYLE_ACCENT);
        addPlayer.setDisable(partyMemberSelector.isDisabled());
        TextField encounterDays = new TextField(setup.encounterDaysText());
        encounterDays.setPromptText("Tage");
        encounterDays.getStyleClass().add(STYLE_COMPACT);
        encounterDays.setDisable(setup.sessionActionsDisabled());
        Button applyDays = actionButton("Setzen", ignored -> publishEncounterDays(encounterDays.getText()), STYLE_FLAT);
        applyDays.setDisable(setup.sessionActionsDisabled());

        HBox inputRow = actionRow(
                label("Spieler", "session-planner-card-title"),
                partyMemberSelector,
                addPlayer,
                label("Tage", "session-planner-card-title"),
                encounterDays,
                applyDays,
                label(setup.sceneTargetText(), "session-planner-scene-target"));
        HBox.setHgrow(partyMemberSelector, Priority.ALWAYS);
        HBox.setHgrow(encounterDays, Priority.ALWAYS);

        HBox participantRow = new HBox(6);
        participantRow.getChildren().add(label("In Session", "session-planner-card-title"));
        for (SessionPlannerTimelineMainContentModel.Projection.SessionParticipantModel participant
                : setup.sessionParticipantRows()) {
            Button remove = actionButton(
                    participant.removeText(),
                    event -> publishParticipantRemove(participant.characterId()),
                    STYLE_FLAT);
            remove.setDisable(participant.actionDisabled());
            remove.setVisible(participant.removeVisible());
            remove.setManaged(participant.removeVisible());
            participantRow.getChildren().add(new ActionRow(
                    4,
                    label(participant.name(), "session-planner-plan-name", participant.detailStyleClass()),
                    remove));
        }
        participantRow.getChildren().add(spacer());
        participantRow.getChildren().add(label(setup.budgetText(), STYLE_TEXT_SECONDARY));
        participantRow.getChildren().add(label(setup.restText(), STYLE_TEXT_SECONDARY));

        VBox box = new VBox(6, inputRow, participantRow);
        addStyles(box, "session-planner-setup-strip");
        return box;
    }

    private Node sceneCard(
            SessionPlannerTimelineMainContentModel.Projection.SceneModel scene,
            int position
    ) {
        Label title = label("Szene " + position + ": " + scene.sceneTitle(), "session-planner-encounter-title");
        Label stateHint = label(
                scene.selected()
                        ? "Diese Szene speist aktuell das State-Panel."
                        : "Wird im State-Panel sichtbar, sobald er ausgewaehlt ist.",
                scene.selected() ? "session-planner-gap-active" : STYLE_TEXT_SECONDARY);

        Button select = actionButton(
                scene.selected() ? "Ausgewaehlt" : "Auswaehlen",
                this::publishSelection,
                scene.selected() ? STYLE_FLAT : STYLE_ACCENT);
        select.setUserData(Long.valueOf(scene.sceneToken()));
        select.setDisable(scene.selected());

        Button decreaseAllocation = actionButton("-10%", this::publishAllocation, STYLE_FLAT);
        decreaseAllocation.setUserData(new Object[] {
                Long.valueOf(scene.sceneToken()),
                scene.budgetPercentage().subtract(ALLOCATION_STEP)
        });
        Button increaseAllocation = actionButton("+10%", this::publishAllocation, STYLE_FLAT);
        increaseAllocation.setUserData(new Object[] {
                Long.valueOf(scene.sceneToken()),
                scene.budgetPercentage().add(ALLOCATION_STEP)
        });

        Button up = actionButton("Hoch", this::publishMove, STYLE_FLAT);
        up.setUserData(new Object[] {Long.valueOf(scene.sceneToken()), Integer.valueOf(-1)});
        up.setDisable(!scene.canMoveUp());

        Button down = actionButton("Runter", this::publishMove, STYLE_FLAT);
        down.setUserData(new Object[] {Long.valueOf(scene.sceneToken()), Integer.valueOf(1)});
        down.setDisable(!scene.canMoveDown());

        Button remove = actionButton("X", this::publishRemoval, STYLE_FLAT);
        remove.setUserData(Long.valueOf(scene.sceneToken()));

        VBox card = new VBox(6,
                new ActionRow(8, title, spacer(), remove),
                linkedEncounterSummary(scene),
                stateHint,
                sceneSection(scene),
                actionRow(select, decreaseAllocation, increaseAllocation),
                actionRow(up, down),
                lootSection(scene));
        addStyles(card, "session-planner-encounter-card");
        return card;
    }

    private Node linkedEncounterSummary(SessionPlannerTimelineMainContentModel.Projection.SceneModel scene) {
        if (!scene.linkedEncounterPlan()) {
            return label("Keine Begegnung verknuepft.", STYLE_TEXT_SECONDARY);
        }
        VBox summary = new VBox(
                4,
                label(scene.linkedEncounterName(), "session-planner-plan-name"),
                label(scene.linkedEncounterCreatureCount() + " Kreaturen" + generatedLabelSuffix(scene), STYLE_TEXT_SECONDARY),
                label(scene.budgetPercentageText() + " Budget · Ziel " + scene.targetXpText() + " XP",
                        "session-planner-encounter-budget"),
                label(scene.comparisonText() + " · " + scene.linkedEncounterDifficultyLabel(), STYLE_TEXT_SECONDARY),
                label("Base " + scene.linkedEncounterTotalBaseXp()
                                + " XP · Multiplikator x"
                                + String.format(Locale.US, "%.2f", scene.linkedEncounterXpMultiplier()),
                        STYLE_TEXT_SECONDARY));
        addStyles(summary, "session-planner-scene-encounter-summary");
        return summary;
    }

    private Node sceneSection(SessionPlannerTimelineMainContentModel.Projection.SceneModel scene) {
        TextField title = new TextField(scene.sceneTitle());
        title.setPromptText("Szenentitel");
        title.getStyleClass().add(STYLE_COMPACT);
        LocationComboBox location = new LocationComboBox(scene.locationChoices(), scene.locationId());
        TextArea notes = new TextArea(scene.sceneNotes());
        notes.setPromptText("Szenennotizen");
        notes.setPrefRowCount(2);
        notes.getStyleClass().add(STYLE_COMPACT);
        Runnable publishDraft = () -> publishSceneDraft(
                scene.sceneToken(),
                title.getText(),
                notes.getText(),
                location.selectedLocationId());
        title.textProperty().addListener((ignored, before, after) -> publishDraft.run());
        notes.textProperty().addListener((ignored, before, after) -> publishDraft.run());
        location.valueProperty().addListener((ignored, before, after) -> publishDraft.run());

        Button save = actionButton("Szene speichern", event -> publishSceneUpdate(
                scene.sceneToken(),
                title.getText(),
                notes.getText(),
                location.selectedLocationId()),
                STYLE_ACCENT);

        return new VBox(
                6,
                label("Szene", "session-planner-gap-title"),
                label(scene.locationLabel(), STYLE_TEXT_SECONDARY),
                title,
                notes,
                actionRow(location, save));
    }

    private Node lootSection(SessionPlannerTimelineMainContentModel.Projection.SceneModel scene) {
        Button addButton = actionButton("Loot-Platzhalter", this::publishAddLoot, STYLE_ACCENT);
        addButton.setUserData(Long.valueOf(scene.sceneToken()));
        VBox rows = new VBox(6);
        if (scene.lootPlaceholders().isEmpty()) {
            addNode(rows, label(
                    "Keine Loot-Platzhalter fuer diese Szene.",
                    STYLE_TEXT_SECONDARY,
                    "session-planner-empty"));
        } else {
            for (SessionPlannerTimelineMainContentModel.Projection.LootModel loot : scene.lootPlaceholders()) {
                addNode(rows, lootCard(loot));
            }
        }
        return new VBox(
                6,
                new ActionRow(8, label("Loot", "session-planner-gap-title"), addButton),
                rows);
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
            int leftScene,
            int rightScene
    ) {
        Label title = label(
                "Zwischen Szene " + leftScene + " und " + rightScene,
                "session-planner-gap-title");
        Label current = label(gap.label(), gap.hasAssignedRest() ? "session-planner-gap-active" : STYLE_TEXT_SECONDARY);

        Button shortRest = actionButton("Kurze Rast",
                ignored -> publishRestGap(new SessionPlannerTimelineMainViewInputEvent.RestSnapshot(
                        gap.leftSceneToken(),
                        gap.rightSceneToken(),
                        true,
                        false)),
                STYLE_FLAT);
        Button longRest = actionButton("Lange Rast",
                ignored -> publishRestGap(new SessionPlannerTimelineMainViewInputEvent.RestSnapshot(
                        gap.leftSceneToken(),
                        gap.rightSceneToken(),
                        false,
                        true)),
                STYLE_FLAT);
        Button clear = actionButton("Leeren",
                ignored -> publishRestGap(new SessionPlannerTimelineMainViewInputEvent.RestSnapshot(
                        gap.leftSceneToken(),
                        gap.rightSceneToken(),
                        false,
                        false)),
                STYLE_FLAT);
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
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.SelectionSnapshot(
                token,
                0L,
                BigDecimal.ZERO)));
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
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.SelectionSnapshot(
                0L,
                token,
                allocation)));
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
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.MutationSnapshot(
                token,
                direction,
                0L)));
    }

    private void publishRemoval(ActionEvent event) {
        long token = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number value) {
            token = value.longValue();
        }
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.MutationSnapshot(
                0L,
                0,
                token)));
    }

    private void publishRestGap(SessionPlannerTimelineMainViewInputEvent.RestSnapshot restSnapshot) {
        publish(new SessionPlannerTimelineMainViewInputEvent(restSnapshot));
    }

    private void publishAddLoot(ActionEvent event) {
        long sceneToken = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number token) {
            sceneToken = token.longValue();
        }
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.LootSnapshot(
                sceneToken,
                0L)));
    }

    private void publishRemoveLoot(ActionEvent event) {
        long lootToken = 0L;
        if (event.getSource() instanceof Button button && button.getUserData() instanceof Number token) {
            lootToken = token.longValue();
        }
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.LootSnapshot(
                0L,
                lootToken)));
    }

    private void publishSceneUpdate(long sceneToken, String title, String notes, long locationId) {
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.SceneSnapshot(
                sceneToken,
                title,
                notes,
                locationId)));
    }

    private void publishSceneDraft(long sceneToken, String title, String notes, long locationId) {
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.SceneDraftSnapshot(
                sceneToken,
                title,
                notes,
                locationId)));
    }

    private void publishParticipantAdd(ComboBox<String> participantSelector) {
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.SetupSnapshot(
                participantSelector.getSelectionModel().getSelectedIndex(),
                0L,
                "",
                false)));
    }

    private void publishParticipantRemove(long participantId) {
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.SetupSnapshot(
                -1,
                participantId,
                "",
                false)));
    }

    private void publishEncounterDays(String encounterDays) {
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.SetupSnapshot(
                -1,
                0L,
                encounterDays,
                false)));
    }

    private void publishAddScene() {
        publish(new SessionPlannerTimelineMainViewInputEvent(new SessionPlannerTimelineMainViewInputEvent.SetupSnapshot(
                -1,
                0L,
                "",
                true)));
    }

    private void publish(SessionPlannerTimelineMainViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private static String generatedLabelSuffix(
            SessionPlannerTimelineMainContentModel.Projection.SceneModel scene
    ) {
        return scene.linkedEncounterGeneratedLabel().isBlank() ? "" : " · " + scene.linkedEncounterGeneratedLabel();
    }

    private static Label label(String text, String... styleClasses) {
        return new StyledLabel(text, styleClasses);
    }

    private static Button actionButton(String text, EventHandler<ActionEvent> action, String emphasisStyle) {
        Button button = new StyledButton(text, STYLE_COMPACT, emphasisStyle);
        button.setOnAction(action);
        return button;
    }

    private static HBox actionRow(Node... actions) {
        return new ActionRow(6, actions);
    }

    private static Region spacer() {
        Region region = new Region();
        HBox.setHgrow(region, Priority.ALWAYS);
        return region;
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

    private static final class LocationComboBox
            extends ComboBox<SessionPlannerTimelineMainContentModel.Projection.LocationChoice> {

        private LocationComboBox(
                List<SessionPlannerTimelineMainContentModel.Projection.LocationChoice> choices,
                long selectedLocationId
        ) {
            getItems().setAll(choices == null ? List.of() : choices);
            getSelectionModel().select(choiceForLocationId(selectedLocationId));
            setPromptText("Location");
            getStyleClass().add(STYLE_COMPACT);
            setConverter(new StringConverter<>() {
                @Override
                public String toString(SessionPlannerTimelineMainContentModel.Projection.LocationChoice value) {
                    return value == null ? "" : value.toString();
                }

                @Override
                public SessionPlannerTimelineMainContentModel.Projection.LocationChoice fromString(String text) {
                    return null;
                }
            });
        }

        private long selectedLocationId() {
            SessionPlannerTimelineMainContentModel.Projection.LocationChoice selected = getValue();
            return selected == null ? 0L : selected.id();
        }

        private SessionPlannerTimelineMainContentModel.Projection.LocationChoice choiceForLocationId(
                long selectedLocationId
        ) {
            for (SessionPlannerTimelineMainContentModel.Projection.LocationChoice choice : getItems()) {
                if (choice.id() == selectedLocationId) {
                    return choice;
                }
            }
            return getItems().isEmpty() ? null : getItems().getFirst();
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
