package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

public final class DungeonEditorStateView extends VBox {
    private static final String INCOMPLETE_NEGATIVE_TEXT = "-";
    private static final String CARD_SURFACE_STYLE = "card-surface";
    private static final String CONTENT_CARD_STYLE = "content-card";
    private static final String STATE_CARD_STACK_STYLE = "dungeon-state-card-stack";
    private static final String COORDINATE_ROW_STYLE = "coordinate-row";

    private final Label body = new Label();
    private final VBox corridorPointCards = new VBox();
    private final VBox transitionDestinationCards = new VBox();
    private final VBox transitionCards = new VBox();
    private final VBox stairGeometryCards = new VBox();
    private final VBox narrationCards = new VBox();
    private Consumer<DungeonEditorStateViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonEditorStateView() {
        getStyleClass().addAll("surface-root", "control-stack", "dungeon-state-panel");
        corridorPointCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        transitionDestinationCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        transitionCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        stairGeometryCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        narrationCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        getChildren().addAll(
                new StateCard(body),
                corridorPointCards,
                transitionDestinationCards,
                transitionCards,
                stairGeometryCards,
                narrationCards);
    }

    public void onViewInputEvent(Consumer<DungeonEditorStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    public void bind(DungeonEditorStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        contentModel.stateProjectionProperty().addListener((ignored, before, after) -> showProjection(after));
        showProjection(contentModel.stateProjectionProperty().get());
    }

    private void showNarrationCards(
            List<DungeonEditorStateContentModel.RoomNarrationCardProjection> cards,
            boolean busy,
            String statusText
    ) {
        narrationCards.getChildren().clear();
        for (DungeonEditorStateContentModel.RoomNarrationCardProjection card
                : cards == null ? List.<DungeonEditorStateContentModel.RoomNarrationCardProjection>of() : cards) {
            narrationCards.getChildren().add(new NarrationCard(card, busy, statusText));
        }
    }

    private void showProjection(DungeonEditorStateContentModel.StateProjection projection) {
        body.setText(projection.stateText());
        showCorridorPoint(projection.corridorPoint(), projection.busy());
        showTransitionDestination(projection.transitionDestination(), projection.busy(), projection.statusText());
        showTransitionDescription(projection.transitionDescription(), projection.busy(), projection.statusText());
        showStairGeometry(projection.stairGeometry(), projection.busy(), projection.statusText());
        showNarrationCards(projection.narrationCards(), projection.busy(), projection.statusText());
    }

    private void showCorridorPoint(
            DungeonEditorStateContentModel.CorridorPointProjection corridorPoint,
            boolean busy
    ) {
        corridorPointCards.getChildren().clear();
        if (corridorPoint != null) {
            corridorPointCards.getChildren().add(new CorridorPointCard(corridorPoint, busy));
        }
    }

    private void showTransitionDescription(
            DungeonEditorStateContentModel.TransitionDescriptionProjection transitionDescription,
            boolean busy,
            String statusText
    ) {
        transitionCards.getChildren().clear();
        if (transitionDescription != null) {
            transitionCards.getChildren().add(new TransitionDescriptionCard(
                    transitionDescription,
                    busy,
                    statusText));
        }
    }

    private void showTransitionDestination(
            DungeonEditorStateContentModel.TransitionDestinationProjection transitionDestination,
            boolean busy,
            String statusText
    ) {
        transitionDestinationCards.getChildren().clear();
        if (transitionDestination != null) {
            transitionDestinationCards.getChildren().add(new TransitionDestinationCard(
                    transitionDestination,
                    busy,
                    statusText));
        }
    }

    private void showStairGeometry(
            DungeonEditorStateContentModel.StairGeometryProjection stairGeometry,
            boolean busy,
            String statusText
    ) {
        stairGeometryCards.getChildren().clear();
        if (stairGeometry != null) {
            stairGeometryCards.getChildren().add(new StairGeometryCard(stairGeometry, busy, statusText));
        }
    }

    private static Label muted(String text) {
        Label label = new MutedLabel(text);
        label.setWrapText(true);
        return label;
    }

    private static TextArea textArea(String text) {
        TextArea area = new TextArea(text == null ? "" : text);
        area.setWrapText(true);
        area.setPrefRowCount(3);
        return area;
    }

    private static TextField coordinateField(String text) {
        TextField field = new TextField(text == null ? "" : text);
        field.getStyleClass().add("coordinate-field");
        field.setTextFormatter(new TextFormatter<>(integerTextFilter()));
        return field;
    }

    private static ComboBox<String> comboBox(List<String> values, String selected) {
        ComboBox<String> comboBox = new ComboBox<>();
        comboBox.getItems().addAll(values);
        comboBox.getSelectionModel().select(selected == null || selected.isBlank() ? values.getFirst() : selected);
        return comboBox;
    }

    private static UnaryOperator<TextFormatter.Change> integerTextFilter() {
        return change -> integerFieldText(change.getControlNewText()) ? change : null;
    }

    private static boolean integerFieldText(String text) {
        if (text == null || text.isEmpty()) {
            return true;
        }
        if (INCOMPLETE_NEGATIVE_TEXT.equals(text)) {
            return true;
        }
        try {
            Integer.parseInt(text);
            return true;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private static boolean completeIntegerText(String text) {
        return text != null && !text.isBlank() && !INCOMPLETE_NEGATIVE_TEXT.equals(text);
    }

    private void emitNarrationInput(
            long roomId,
            TextArea visualArea,
            List<TextArea> exitAreas,
            boolean saveRequested
    ) {
        List<String> exitDescriptions = new ArrayList<>();
        for (TextArea exitArea : exitAreas) {
            exitDescriptions.add(exitArea.getText());
        }
        viewInputEventHandler.accept(new DungeonEditorStateViewInputEvent(
                roomId,
                visualArea.getText(),
                exitDescriptions,
                saveRequested));
    }

    private void emitCorridorPointInput(
            TextField qField,
            TextField rField,
            boolean submitRequested
    ) {
        viewInputEventHandler.accept(new DungeonEditorStateViewInputEvent(
                qField.getText(),
                rField.getText(),
                submitRequested));
    }

    private void emitTransitionDescriptionInput(
            long transitionId,
            TextArea descriptionArea,
            boolean saveRequested
    ) {
        viewInputEventHandler.accept(new DungeonEditorStateViewInputEvent(
                transitionId,
                descriptionArea.getText(),
                saveRequested));
    }

    private void emitTransitionDestinationInput(
            ComboBox<String> destinationTypeBox,
            TextField mapIdField,
            TextField tileIdField,
            TextField transitionIdField,
            CheckBox bidirectionalBox,
            boolean saveRequested
    ) {
        viewInputEventHandler.accept(new DungeonEditorStateViewInputEvent(
                destinationTypeBox.getValue(),
                mapIdField.getText(),
                tileIdField.getText(),
                transitionIdField.getText(),
                bidirectionalBox.isSelected(),
                saveRequested));
    }

    private void emitStairGeometryInput(
            long stairId,
            ComboBox<String> shapeBox,
            ComboBox<String> directionBox,
            TextField dimension1Field,
            TextField dimension2Field,
            boolean saveRequested
    ) {
        viewInputEventHandler.accept(new DungeonEditorStateViewInputEvent(
                stairId,
                shapeBox.getValue(),
                directionBox.getValue(),
                dimension1Field.getText(),
                dimension2Field.getText(),
                saveRequested));
    }

    private final class CorridorPointCard extends VBox {

        private CorridorPointCard(
                DungeonEditorStateContentModel.CorridorPointProjection corridorPoint,
                boolean busy
        ) {
            TextField qField = coordinateField(corridorPoint.q());
            TextField rField = coordinateField(corridorPoint.r());
            Label levelValue = muted(corridorPoint.level());
            levelValue.getStyleClass().add("coordinate-value");
            qField.setAccessibleText("Korridorpunkt q");
            rField.setAccessibleText("Korridorpunkt r");
            levelValue.setAccessibleText("Korridorpunkt z");
            HBox row = new HBox(
                    coordinateLabel("q", qField),
                    qField,
                    coordinateLabel("r", rField),
                    rField,
                    coordinateLabel("z", levelValue),
                    levelValue);
            row.getStyleClass().add(COORDINATE_ROW_STYLE);
            Button move = new ToolbarActionButton("Verschieben");
            move.setAccessibleText(corridorPoint.label() + " verschieben");
            Runnable updateMoveDisabled = () -> move.setDisable(
                    busy || !completeIntegerText(qField.getText()) || !completeIntegerText(rField.getText()));
            qField.textProperty().addListener((ignored, before, after) -> {
                emitCorridorPointInput(qField, rField, false);
                updateMoveDisabled.run();
            });
            rField.textProperty().addListener((ignored, before, after) -> {
                emitCorridorPointInput(qField, rField, false);
                updateMoveDisabled.run();
            });
            updateMoveDisabled.run();
            move.setOnAction(event -> emitCorridorPointInput(qField, rField, true));
            getChildren().addAll(new PanelTitle(corridorPoint.label()), row, move);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label coordinateLabel(String text, javafx.scene.Node field) {
            Label label = muted(text);
            label.setLabelFor(field);
            return label;
        }
    }

    private final class TransitionDescriptionCard extends VBox {

        private TransitionDescriptionCard(
                DungeonEditorStateContentModel.TransitionDescriptionProjection transitionDescription,
                boolean busy,
                String statusText
        ) {
            TextArea descriptionArea = textArea(transitionDescription.description());
            descriptionArea.setAccessibleText("Übergang Beschreibung");
            getChildren().addAll(
                    new PanelTitle(transitionDescription.label()),
                    narrationLabel("Beschreibung", descriptionArea),
                    descriptionArea);
            descriptionArea.textProperty().addListener((ignored, before, after) -> emitTransitionDescriptionInput(
                    transitionDescription.transitionId(),
                    descriptionArea,
                    false));
            Label status = muted(statusText);
            status.setVisible(statusText != null && !statusText.isBlank());
            status.setManaged(status.isVisible());
            Button save = new ToolbarActionButton("Speichern");
            save.setAccessibleText(transitionDescription.label() + " speichern");
            save.setDisable(busy);
            save.setOnAction(event -> emitTransitionDescriptionInput(
                    transitionDescription.transitionId(),
                    descriptionArea,
                    true));
            getChildren().addAll(status, save);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label narrationLabel(String text, TextArea area) {
            Label label = muted(text);
            label.setLabelFor(area);
            return label;
        }
    }

    private final class TransitionDestinationCard extends VBox {

        private TransitionDestinationCard(
                DungeonEditorStateContentModel.TransitionDestinationProjection transitionDestination,
                boolean busy,
                String statusText
        ) {
            ComboBox<String> destinationTypeBox =
                    comboBox(List.of("OVERWORLD_TILE", "DUNGEON_MAP"), transitionDestination.destinationType());
            TextField mapIdField = coordinateField(transitionDestination.mapId());
            TextField tileIdField = coordinateField(transitionDestination.tileId());
            TextField transitionIdField = coordinateField(transitionDestination.transitionId());
            CheckBox bidirectionalBox = new CheckBox("Bidirektional");
            bidirectionalBox.setSelected(transitionDestination.bidirectional());
            destinationTypeBox.setAccessibleText("Übergang Zieltyp");
            mapIdField.setAccessibleText("Übergang Zielkarte");
            tileIdField.setAccessibleText("Übergang Zielkachel");
            transitionIdField.setAccessibleText("Übergang Zieluebergang");
            bidirectionalBox.setAccessibleText("Übergang bidirektional verknuepfen");
            Label destinationTypeLabel = labeled("Typ", destinationTypeBox);
            Label mapIdLabel = labeled("Karte", mapIdField);
            Label tileIdLabel = labeled("Kachel", tileIdField);
            Label transitionIdLabel = labeled("Übergang", transitionIdField);
            HBox destinationRow = new HBox(
                    destinationTypeLabel,
                    destinationTypeBox,
                    mapIdLabel,
                    mapIdField);
            destinationRow.getStyleClass().add(COORDINATE_ROW_STYLE);
            HBox targetRow = new HBox(
                    tileIdLabel,
                    tileIdField,
                    transitionIdLabel,
                    transitionIdField);
            targetRow.getStyleClass().add(COORDINATE_ROW_STYLE);
            Label status = muted(statusText);
            status.setVisible(statusText != null && !statusText.isBlank());
            status.setManaged(status.isVisible());
            Button save = new ToolbarActionButton("Verknüpfen");
            save.setAccessibleText(transitionDestination.label() + " speichern");
            Runnable updateDestinationMode = () -> {
                boolean dungeonMapDestination = "DUNGEON_MAP".equals(destinationTypeBox.getValue());
                boolean linkMode = transitionDestination.sourceTransitionId() > 0L;
                destinationTypeBox.setDisable(busy);
                mapIdField.setDisable(busy);
                tileIdField.setDisable(busy || dungeonMapDestination);
                transitionIdField.setDisable(busy || !dungeonMapDestination);
                bidirectionalBox.setDisable(busy || !linkMode || !dungeonMapDestination);
                tileIdLabel.setDisable(dungeonMapDestination);
                transitionIdLabel.setDisable(!dungeonMapDestination);
                save.setDisable(busy
                        || !linkMode
                        || !dungeonMapDestination
                        || !completeIntegerText(mapIdField.getText())
                        || !completeIntegerText(transitionIdField.getText()));
            };
            destinationTypeBox.valueProperty().addListener((ignored, before, after) -> emitTransitionDestinationInput(
                    destinationTypeBox,
                    mapIdField,
                    tileIdField,
                    transitionIdField,
                    bidirectionalBox,
                    false));
            destinationTypeBox.valueProperty().addListener((ignored, before, after) -> updateDestinationMode.run());
            mapIdField.textProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(
                        destinationTypeBox,
                        mapIdField,
                        tileIdField,
                        transitionIdField,
                        bidirectionalBox,
                        false);
                updateDestinationMode.run();
            });
            tileIdField.textProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(
                        destinationTypeBox,
                        mapIdField,
                        tileIdField,
                        transitionIdField,
                        bidirectionalBox,
                        false);
                updateDestinationMode.run();
            });
            transitionIdField.textProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(
                        destinationTypeBox,
                        mapIdField,
                        tileIdField,
                        transitionIdField,
                        bidirectionalBox,
                        false);
                updateDestinationMode.run();
            });
            bidirectionalBox.selectedProperty().addListener((ignored, before, after) -> emitTransitionDestinationInput(
                    destinationTypeBox,
                    mapIdField,
                    tileIdField,
                    transitionIdField,
                    bidirectionalBox,
                    false));
            updateDestinationMode.run();
            save.setVisible(transitionDestination.sourceTransitionId() > 0L);
            save.setManaged(save.isVisible());
            bidirectionalBox.setVisible(transitionDestination.sourceTransitionId() > 0L);
            bidirectionalBox.setManaged(bidirectionalBox.isVisible());
            save.setOnAction(event -> emitTransitionDestinationInput(
                    destinationTypeBox,
                    mapIdField,
                    tileIdField,
                    transitionIdField,
                    bidirectionalBox,
                    true));
            getChildren().addAll(
                    new PanelTitle(transitionDestination.label()),
                    destinationRow,
                    targetRow,
                    bidirectionalBox,
                    status,
                    save);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label labeled(String text, javafx.scene.Node field) {
            Label label = muted(text);
            label.setLabelFor(field);
            return label;
        }
    }

    private final class StairGeometryCard extends VBox {

        private StairGeometryCard(
                DungeonEditorStateContentModel.StairGeometryProjection stairGeometry,
                boolean busy,
                String statusText
        ) {
            ComboBox<String> shapeBox = comboBox(List.of("STRAIGHT", "SQUARE", "CIRCULAR"), stairGeometry.shapeName());
            ComboBox<String> directionBox = comboBox(List.of("NORTH", "EAST", "SOUTH", "WEST"), stairGeometry.directionName());
            TextField dimension1Field = coordinateField(stairGeometry.dimension1());
            TextField dimension2Field = coordinateField(stairGeometry.dimension2());
            shapeBox.setAccessibleText("Treppe Form");
            directionBox.setAccessibleText("Treppe Richtung");
            dimension1Field.setAccessibleText("Treppe Laenge");
            dimension2Field.setAccessibleText("Treppe Ebenenspanne");
            HBox specRow = new HBox(
                    labeled("Form", shapeBox),
                    shapeBox,
                    labeled("Richtung", directionBox),
                    directionBox);
            specRow.getStyleClass().add(COORDINATE_ROW_STYLE);
            HBox dimensionRow = new HBox(
                    labeled("d1", dimension1Field),
                    dimension1Field,
                    labeled("d2", dimension2Field),
                    dimension2Field);
            dimensionRow.getStyleClass().add(COORDINATE_ROW_STYLE);
            Label status = muted(statusText);
            status.setVisible(statusText != null && !statusText.isBlank());
            status.setManaged(status.isVisible());
            Button save = new ToolbarActionButton("Treppe aktualisieren");
            save.setAccessibleText(stairGeometry.label() + " Geometrie speichern");
            Runnable updateDisabled = () -> save.setDisable(
                    busy
                            || !completeIntegerText(dimension1Field.getText())
                            || !completeIntegerText(dimension2Field.getText()));
            shapeBox.valueProperty().addListener((ignored, before, after) -> emitStairGeometryInput(
                    stairGeometry.stairId(),
                    shapeBox,
                    directionBox,
                    dimension1Field,
                    dimension2Field,
                    false));
            directionBox.valueProperty().addListener((ignored, before, after) -> emitStairGeometryInput(
                    stairGeometry.stairId(),
                    shapeBox,
                    directionBox,
                    dimension1Field,
                    dimension2Field,
                    false));
            dimension1Field.textProperty().addListener((ignored, before, after) -> {
                emitStairGeometryInput(stairGeometry.stairId(), shapeBox, directionBox, dimension1Field, dimension2Field, false);
                updateDisabled.run();
            });
            dimension2Field.textProperty().addListener((ignored, before, after) -> {
                emitStairGeometryInput(stairGeometry.stairId(), shapeBox, directionBox, dimension1Field, dimension2Field, false);
                updateDisabled.run();
            });
            updateDisabled.run();
            save.setOnAction(event -> emitStairGeometryInput(
                    stairGeometry.stairId(),
                    shapeBox,
                    directionBox,
                    dimension1Field,
                    dimension2Field,
                    true));
            getChildren().addAll(new PanelTitle(stairGeometry.label()), specRow, dimensionRow, status, save);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label labeled(String text, javafx.scene.Node field) {
            Label label = muted(text);
            label.setLabelFor(field);
            return label;
        }
    }

    private final class NarrationCard extends VBox {

        private NarrationCard(
                DungeonEditorStateContentModel.RoomNarrationCardProjection card,
                boolean busy,
                String statusText
        ) {
            TextArea visualArea = textArea(card.visualDescription());
            List<TextArea> exitAreas = new ArrayList<>();
            getChildren().addAll(new PanelTitle(card.roomName()), narrationLabel("Visueller Eindruck", visualArea), visualArea);
            for (DungeonEditorStateContentModel.RoomExitNarrationProjection exit : card.exits()) {
                TextArea exitArea = textArea(exit.description());
                exitArea.setAccessibleText(exit.label());
                exitAreas.add(exitArea);
                getChildren().addAll(narrationLabel(exit.label(), exitArea), exitArea);
            }
            visualArea.textProperty().addListener((ignored, before, after) -> emitNarrationInput(
                    card.roomId(),
                    visualArea,
                    exitAreas,
                    false));
            for (TextArea exitArea : exitAreas) {
                exitArea.textProperty().addListener((ignored, before, after) -> emitNarrationInput(
                        card.roomId(),
                        visualArea,
                        exitAreas,
                        false));
            }
            Label status = muted(statusText);
            status.setVisible(statusText != null && !statusText.isBlank());
            status.setManaged(status.isVisible());
            Button save = new ToolbarActionButton("Speichern");
            save.setAccessibleText("Narration fuer " + card.roomName() + " speichern");
            save.setDisable(busy);
            save.setOnAction(event -> emitNarrationInput(card.roomId(), visualArea, exitAreas, true));
            getChildren().addAll(status, save);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label narrationLabel(String text, TextArea area) {
            Label label = muted(text);
            label.setLabelFor(area);
            return label;
        }
    }

    private static final class StateCard extends VBox {

        private StateCard(Label body) {
            getChildren().addAll(new PanelTitle("Editor state"), body);
            body.setWrapText(true);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }
    }

    private static final class PanelTitle extends Label {

        private PanelTitle(String text) {
            super(text);
            getStyleClass().add("panel-title");
        }
    }

    private static final class MutedLabel extends Label {

        private MutedLabel(String text) {
            super(text == null ? "" : text);
            getStyleClass().add("text-muted");
        }
    }

    private static final class ToolbarActionButton extends Button {

        private ToolbarActionButton(String text) {
            super(text);
            getStyleClass().add("toolbar-action-button");
        }
    }
}
