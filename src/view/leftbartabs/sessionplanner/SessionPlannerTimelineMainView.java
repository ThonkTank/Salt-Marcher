package src.view.leftbartabs.sessionplanner;

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

    private static final String WIDGET_SCENE_SELECT = "session-planner.timeline.scene.select";
    private static final String WIDGET_ALLOCATION_DECREASE = "session-planner.timeline.allocation.decrease";
    private static final String WIDGET_ALLOCATION_INCREASE = "session-planner.timeline.allocation.increase";
    private static final String WIDGET_SCENE_MOVE_UP = "session-planner.timeline.scene.move-up";
    private static final String WIDGET_SCENE_MOVE_DOWN = "session-planner.timeline.scene.move-down";
    private static final String WIDGET_SCENE_REMOVE = "session-planner.timeline.scene.remove";
    private static final String WIDGET_REST_SHORT = "session-planner.timeline.rest.short";
    private static final String WIDGET_REST_LONG = "session-planner.timeline.rest.long";
    private static final String WIDGET_REST_CLEAR = "session-planner.timeline.rest.clear";
    private static final String WIDGET_LOOT_ADD = "session-planner.timeline.loot.add";
    private static final String WIDGET_LOOT_REMOVE = "session-planner.timeline.loot.remove";
    private static final String WIDGET_SCENE_SAVE = "session-planner.timeline.scene.save";
    private static final String WIDGET_SCENE_DRAFT = "session-planner.timeline.scene.draft";
    private static final String WIDGET_PARTICIPANT_ADD = "session-planner.timeline.participant.add";
    private static final String WIDGET_PARTICIPANT_REMOVE = "session-planner.timeline.participant.remove";
    private static final String WIDGET_ENCOUNTER_DAYS = "session-planner.timeline.encounter-days.apply";
    private static final String WIDGET_SCENE_ADD = "session-planner.timeline.scene.add";
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
        Button addScene = actionButton(
                "Szene hinzufuegen",
                WIDGET_SCENE_ADD,
                event -> rawPublish(event),
                STYLE_ACCENT);
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
                WIDGET_PARTICIPANT_ADD,
                event -> rawPublishParticipantAdd(event, partyMemberSelector),
                STYLE_ACCENT);
        addPlayer.setDisable(partyMemberSelector.isDisabled());
        TextField encounterDays = new TextField(setup.encounterDaysText());
        encounterDays.setPromptText("Tage");
        encounterDays.getStyleClass().add(STYLE_COMPACT);
        encounterDays.setDisable(setup.sessionActionsDisabled());
        Button applyDays = actionButton(
                "Setzen",
                WIDGET_ENCOUNTER_DAYS,
                event -> rawPublishEncounterDays(event, encounterDays.getText()),
                STYLE_FLAT);
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
                    WIDGET_PARTICIPANT_REMOVE,
                    event -> rawPublishParticipantRemove(event, participant.characterId()),
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
                WIDGET_SCENE_SELECT,
                event -> rawPublishScene(event, scene.sceneToken()),
                scene.selected() ? STYLE_FLAT : STYLE_ACCENT);
        select.setDisable(scene.selected());

        Button decreaseAllocation = actionButton(
                "-10%",
                WIDGET_ALLOCATION_DECREASE,
                event -> rawPublishScene(event, scene.sceneToken()),
                STYLE_FLAT);
        Button increaseAllocation = actionButton(
                "+10%",
                WIDGET_ALLOCATION_INCREASE,
                event -> rawPublishScene(event, scene.sceneToken()),
                STYLE_FLAT);

        Button up = actionButton(
                "Hoch",
                WIDGET_SCENE_MOVE_UP,
                event -> rawPublishScene(event, scene.sceneToken()),
                STYLE_FLAT);
        up.setDisable(!scene.canMoveUp());

        Button down = actionButton(
                "Runter",
                WIDGET_SCENE_MOVE_DOWN,
                event -> rawPublishScene(event, scene.sceneToken()),
                STYLE_FLAT);
        down.setDisable(!scene.canMoveDown());

        Button remove = actionButton(
                "X",
                WIDGET_SCENE_REMOVE,
                event -> rawPublishScene(event, scene.sceneToken()),
                STYLE_FLAT);

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
        Runnable publishDraft = () -> rawPublishSceneDraft(
                scene.sceneToken(),
                title.getText(),
                notes.getText(),
                location.selectedLocationId());
        title.textProperty().addListener((ignored, before, after) -> publishDraft.run());
        notes.textProperty().addListener((ignored, before, after) -> publishDraft.run());
        location.valueProperty().addListener((ignored, before, after) -> publishDraft.run());

        Button save = actionButton(
                "Szene speichern",
                WIDGET_SCENE_SAVE,
                event -> rawPublishSceneText(
                        event,
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
        Button addButton = actionButton(
                "Loot-Platzhalter",
                WIDGET_LOOT_ADD,
                event -> rawPublishScene(event, scene.sceneToken()),
                STYLE_ACCENT);
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
        Button remove = actionButton(
                "Entfernen",
                WIDGET_LOOT_REMOVE,
                event -> rawPublishLoot(event, loot.token()),
                STYLE_FLAT);
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
                WIDGET_REST_SHORT,
                event -> rawPublishRestGap(event, gap.leftSceneToken(), gap.rightSceneToken()),
                STYLE_FLAT);
        Button longRest = actionButton("Lange Rast",
                WIDGET_REST_LONG,
                event -> rawPublishRestGap(event, gap.leftSceneToken(), gap.rightSceneToken()),
                STYLE_FLAT);
        Button clear = actionButton("Leeren",
                WIDGET_REST_CLEAR,
                event -> rawPublishRestGap(event, gap.leftSceneToken(), gap.rightSceneToken()),
                STYLE_FLAT);
        clear.setDisable(!gap.hasAssignedRest());

        VBox card = new VBox(6, title, current, actionRow(shortRest, longRest, clear));
        addStyles(card, "session-planner-gap-card");
        return card;
    }

    private void rawPublish(ActionEvent event) {
        rawPublish(rawWidgetId(event), 0L, 0L, 0L, 0L, 0L, -1, "", "", "", 0L);
    }

    private void rawPublishScene(ActionEvent event, long sceneToken) {
        rawPublish(rawWidgetId(event), sceneToken, 0L, 0L, 0L, 0L, -1, "", "", "", 0L);
    }

    private void rawPublishRestGap(ActionEvent event, long leftSceneToken, long rightSceneToken) {
        rawPublish(rawWidgetId(event), 0L, leftSceneToken, rightSceneToken, 0L, 0L, -1, "", "", "", 0L);
    }

    private void rawPublishLoot(ActionEvent event, long lootToken) {
        rawPublish(rawWidgetId(event), 0L, 0L, 0L, lootToken, 0L, -1, "", "", "", 0L);
    }

    private void rawPublishSceneText(
            ActionEvent event,
            long sceneToken,
            String sceneTitle,
            String sceneNotes,
            long locationId
    ) {
        rawPublish(rawWidgetId(event), sceneToken, 0L, 0L, 0L, 0L, -1, "", sceneTitle, sceneNotes, locationId);
    }

    private void rawPublishSceneDraft(long sceneToken, String sceneTitle, String sceneNotes, long locationId) {
        rawPublish(WIDGET_SCENE_DRAFT, sceneToken, 0L, 0L, 0L, 0L, -1, "", sceneTitle, sceneNotes, locationId);
    }

    private void rawPublishParticipantAdd(ActionEvent event, ComboBox<String> participantSelector) {
        rawPublish(
                rawWidgetId(event),
                0L,
                0L,
                0L,
                0L,
                0L,
                participantSelector.getSelectionModel().getSelectedIndex(),
                "",
                "",
                "",
                0L);
    }

    private void rawPublishParticipantRemove(ActionEvent event, long participantId) {
        rawPublish(rawWidgetId(event), 0L, 0L, 0L, 0L, participantId, -1, "", "", "", 0L);
    }

    private void rawPublishEncounterDays(ActionEvent event, String encounterDays) {
        rawPublish(rawWidgetId(event), 0L, 0L, 0L, 0L, 0L, -1, encounterDays, "", "", 0L);
    }

    private void rawPublish(
            String widgetId,
            long sceneToken,
            long leftSceneToken,
            long rightSceneToken,
            long lootToken,
            long participantId,
            int participantChoiceIndex,
            String encounterDaysText,
            String sceneTitleText,
            String sceneNotesText,
            long locationId
    ) {
        publish(new SessionPlannerTimelineMainViewInputEvent(
                widgetId,
                sceneToken,
                leftSceneToken,
                rightSceneToken,
                lootToken,
                participantId,
                participantChoiceIndex,
                encounterDaysText,
                sceneTitleText,
                sceneNotesText,
                locationId));
    }

    private String rawWidgetId(ActionEvent event) {
        if (event.getSource() instanceof Node node) {
            return node.getId();
        }
        return "";
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

    private static Button actionButton(
            String text,
            String widgetId,
            EventHandler<ActionEvent> action,
            String emphasisStyle
    ) {
        Button button = new StyledButton(text, STYLE_COMPACT, emphasisStyle);
        button.setId(widgetId);
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
