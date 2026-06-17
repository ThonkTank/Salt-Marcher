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
    private static final String SAVE_ACTION_SUFFIX = " speichern";

    private final Label body = new Label();
    private final VBox corridorPointCards = new VBox();
    private final VBox transitionDestinationCards = new VBox();
    private final VBox transitionCards = new VBox();
    private final VBox stairGeometryCards = new VBox();
    private final VBox narrationCards = new VBox();
    private final VBox nameCards = new VBox();
    private Consumer<DungeonEditorStateViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonEditorStateView() {
        getStyleClass().addAll("surface-root", "control-stack", "dungeon-state-panel");
        corridorPointCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        transitionDestinationCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        transitionCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        stairGeometryCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        narrationCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        nameCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        getChildren().addAll(
                new StateCard(body),
                nameCards,
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
        showName(projection.name(), projection.busy());
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

    private void showName(
            DungeonEditorStateContentModel.NameProjection name,
            boolean busy
    ) {
        nameCards.getChildren().clear();
        if (name != null) {
            nameCards.getChildren().add(new NameCard(name, busy));
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

    private static TextField textField(String text) {
        TextField field = new TextField(text == null ? "" : text);
        field.getStyleClass().add("coordinate-field");
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

    private void emitNameInput(
            String targetKind,
            long targetId,
            TextField nameField,
            boolean saveRequested
    ) {
        viewInputEventHandler.accept(new DungeonEditorStateViewInputEvent(
                targetKind,
                targetId,
                nameField.getText(),
                true,
                saveRequested));
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

    private final class NameCard extends VBox {

        private NameCard(DungeonEditorStateContentModel.NameProjection name, boolean busy) {
            String targetKind = name.targetKind();
            long targetId = name.targetId();
            TextField nameField = textField(name.name());
            nameField.setAccessibleText(name.label());
            Label fieldLabel = labeled("Name", nameField);
            Button save = new ToolbarActionButton("Speichern");
            save.setAccessibleText(name.label() + SAVE_ACTION_SUFFIX);
            Runnable updateDisabled = () -> save.setDisable(busy || nameField.getText().isBlank());
            nameField.textProperty().addListener((ignored, before, after) -> {
                emitNameInput(targetKind, targetId, nameField, false);
                updateDisabled.run();
            });
            updateDisabled.run();
            save.setOnAction(event -> emitNameInput(targetKind, targetId, nameField, true));
            getChildren().addAll(new PanelTitle(name.label()), fieldLabel, nameField, save);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label labeled(String text, javafx.scene.Node field) {
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
            save.setAccessibleText(transitionDescription.label() + SAVE_ACTION_SUFFIX);
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
            boolean linkMode = transitionDestination.sourceTransitionId() > 0L;
            TransitionDestinationControls controls = createControls(transitionDestination, linkMode, statusText);
            HBox destinationRow = destinationRow(controls);
            HBox targetRow = targetRow(controls);
            Runnable updateDestinationMode = () -> updateDestinationMode(linkMode, busy, controls);
            installInputListeners(controls, updateDestinationMode);
            updateDestinationMode.run();
            configureLinkControls(linkMode, controls);
            controls.save().setOnAction(event -> emitTransitionDestinationInput(controls, true));
            addCardChildren(transitionDestination, linkMode, controls, destinationRow, targetRow);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private TransitionDestinationControls createControls(
                DungeonEditorStateContentModel.TransitionDestinationProjection transitionDestination,
                boolean linkMode,
                String statusText
        ) {
            return linkMode
                    ? createLinkControls(transitionDestination, statusText)
                    : createDestinationControls(transitionDestination, statusText);
        }

        private TransitionDestinationControls createLinkControls(
                DungeonEditorStateContentModel.TransitionDestinationProjection transitionDestination,
                String statusText
        ) {
            ComboBox<String> destinationTypeBox =
                    comboBox(List.of("OVERWORLD_TILE", "DUNGEON_MAP"), transitionDestination.destinationType());
            TextField mapIdField = coordinateField(transitionDestination.mapId());
            TextField tileIdField = coordinateField(transitionDestination.tileId());
            TextField transitionIdField = coordinateField(transitionDestination.transitionId());
            CheckBox bidirectionalBox = new CheckBox("Ruecklink zum ausgewaehlten Eingang speichern");
            bidirectionalBox.setSelected(transitionDestination.bidirectional());
            destinationTypeBox.setAccessibleText("Eingangslink Zieltyp");
            mapIdField.setAccessibleText("Eingangslink Zielkarte");
            tileIdField.setAccessibleText("Eingangslink Zielkachel");
            transitionIdField.setAccessibleText("Eingangslink Zieluebergang");
            bidirectionalBox.setAccessibleText("Ruecklink zum ausgewaehlten Eingang speichern");
            Label sourceLabel = muted("Quelle: ausgewaehlter Übergang");
            Label targetHintLabel = muted("Eingangslink: Zieltyp DUNGEON_MAP und Ziel-Eingang wählen");
            Label destinationTypeLabel = labeled("Zieltyp", destinationTypeBox);
            Label mapIdLabel = labeled("Zielkarte", mapIdField);
            Label tileIdLabel = labeled("Zielkachel", tileIdField);
            Label transitionIdLabel = labeled("Ziel-Eingang", transitionIdField);
            Label status = muted(statusText);
            status.setVisible(statusText != null && !statusText.isBlank());
            status.setManaged(status.isVisible());
            Button save = new ToolbarActionButton("Eingangslink speichern");
            save.setAccessibleText(transitionDestination.label() + SAVE_ACTION_SUFFIX);
            return new TransitionDestinationControls(
                    destinationTypeBox,
                    mapIdField,
                    tileIdField,
                    transitionIdField,
                    bidirectionalBox,
                    sourceLabel,
                    targetHintLabel,
                    destinationTypeLabel,
                    mapIdLabel,
                    tileIdLabel,
                    transitionIdLabel,
                    status,
                    save);
        }

        private TransitionDestinationControls createDestinationControls(
                DungeonEditorStateContentModel.TransitionDestinationProjection transitionDestination,
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
            Label status = muted(statusText);
            status.setVisible(statusText != null && !statusText.isBlank());
            status.setManaged(status.isVisible());
            Button save = new ToolbarActionButton("Verknüpfen");
            save.setAccessibleText(transitionDestination.label() + SAVE_ACTION_SUFFIX);
            return new TransitionDestinationControls(
                    destinationTypeBox,
                    mapIdField,
                    tileIdField,
                    transitionIdField,
                    bidirectionalBox,
                    muted(""),
                    muted(""),
                    labeled("Typ", destinationTypeBox),
                    labeled("Karte", mapIdField),
                    labeled("Kachel", tileIdField),
                    labeled("Übergang", transitionIdField),
                    status,
                    save);
        }

        private HBox destinationRow(TransitionDestinationControls controls) {
            HBox row = new HBox(
                    controls.destinationTypeLabel(),
                    controls.destinationTypeBox(),
                    controls.mapIdLabel(),
                    controls.mapIdField());
            row.getStyleClass().add(COORDINATE_ROW_STYLE);
            return row;
        }

        private HBox targetRow(TransitionDestinationControls controls) {
            HBox row = new HBox(
                    controls.tileIdLabel(),
                    controls.tileIdField(),
                    controls.transitionIdLabel(),
                    controls.transitionIdField());
            row.getStyleClass().add(COORDINATE_ROW_STYLE);
            return row;
        }

        private void updateDestinationMode(
                boolean linkMode,
                boolean busy,
                TransitionDestinationControls controls
        ) {
            boolean dungeonMapDestination = "DUNGEON_MAP".equals(controls.destinationTypeBox().getValue());
            boolean readOnlySelectedOverworld = linkMode && !dungeonMapDestination;
            boolean targetFieldsComplete = completeIntegerText(controls.mapIdField().getText())
                    && completeIntegerText(controls.transitionIdField().getText());
            controls.destinationTypeBox().setDisable(busy);
            controls.mapIdField().setDisable(mapIdDisabled(busy, readOnlySelectedOverworld));
            controls.tileIdField().setDisable(tileIdDisabled(busy, dungeonMapDestination, readOnlySelectedOverworld));
            controls.transitionIdField().setDisable(transitionIdDisabled(busy, dungeonMapDestination));
            controls.bidirectionalBox().setDisable(bidirectionalDisabled(busy, linkMode, dungeonMapDestination));
            controls.mapIdLabel().setDisable(readOnlySelectedOverworld);
            controls.tileIdLabel().setDisable(tileIdLabelDisabled(dungeonMapDestination, readOnlySelectedOverworld));
            controls.transitionIdLabel().setDisable(!dungeonMapDestination);
            controls.save().setDisable(saveDisabled(busy, linkMode, dungeonMapDestination, targetFieldsComplete));
        }

        private boolean mapIdDisabled(boolean busy, boolean readOnlySelectedOverworld) {
            return busy || readOnlySelectedOverworld;
        }

        private boolean tileIdDisabled(
                boolean busy,
                boolean dungeonMapDestination,
                boolean readOnlySelectedOverworld
        ) {
            return busy || dungeonMapDestination || readOnlySelectedOverworld;
        }

        private boolean transitionIdDisabled(boolean busy, boolean dungeonMapDestination) {
            return busy || !dungeonMapDestination;
        }

        private boolean bidirectionalDisabled(
                boolean busy,
                boolean linkMode,
                boolean dungeonMapDestination
        ) {
            return busy || !linkMode || !dungeonMapDestination;
        }

        private boolean tileIdLabelDisabled(boolean dungeonMapDestination, boolean readOnlySelectedOverworld) {
            return dungeonMapDestination || readOnlySelectedOverworld;
        }

        private boolean saveDisabled(
                boolean busy,
                boolean linkMode,
                boolean dungeonMapDestination,
                boolean targetFieldsComplete
        ) {
            return busy || !linkMode || !dungeonMapDestination || !targetFieldsComplete;
        }

        private void installInputListeners(
                TransitionDestinationControls controls,
                Runnable updateDestinationMode
        ) {
            controls.destinationTypeBox().valueProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(controls, false);
                updateDestinationMode.run();
            });
            controls.mapIdField().textProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(controls, false);
                updateDestinationMode.run();
            });
            controls.tileIdField().textProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(controls, false);
                updateDestinationMode.run();
            });
            controls.transitionIdField().textProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(controls, false);
                updateDestinationMode.run();
            });
            controls.bidirectionalBox().selectedProperty().addListener((ignored, before, after) ->
                    emitTransitionDestinationInput(controls, false));
        }

        private void configureLinkControls(boolean linkMode, TransitionDestinationControls controls) {
            controls.save().setVisible(linkMode);
            controls.save().setManaged(linkMode);
            controls.bidirectionalBox().setVisible(linkMode);
            controls.bidirectionalBox().setManaged(linkMode);
        }

        private void addCardChildren(
                DungeonEditorStateContentModel.TransitionDestinationProjection transitionDestination,
                boolean linkMode,
                TransitionDestinationControls controls,
                HBox destinationRow,
                HBox targetRow
        ) {
            getChildren().add(new PanelTitle(transitionDestination.label()));
            if (linkMode) {
                getChildren().add(controls.sourceLabel());
            }
            getChildren().add(destinationRow);
            if (linkMode) {
                getChildren().add(controls.targetHintLabel());
            }
            getChildren().addAll(targetRow, controls.bidirectionalBox(), controls.status(), controls.save());
        }

        private void emitTransitionDestinationInput(
                TransitionDestinationControls controls,
                boolean saveRequested
        ) {
            DungeonEditorStateView.this.emitTransitionDestinationInput(
                    controls.destinationTypeBox(),
                    controls.mapIdField(),
                    controls.tileIdField(),
                    controls.transitionIdField(),
                    controls.bidirectionalBox(),
                    saveRequested);
        }

        private Label labeled(String text, javafx.scene.Node field) {
            Label label = muted(text);
            label.setLabelFor(field);
            return label;
        }

        private record TransitionDestinationControls(
                ComboBox<String> destinationTypeBox,
                TextField mapIdField,
                TextField tileIdField,
                TextField transitionIdField,
                CheckBox bidirectionalBox,
                Label sourceLabel,
                Label targetHintLabel,
                Label destinationTypeLabel,
                Label mapIdLabel,
                Label tileIdLabel,
                Label transitionIdLabel,
                Label status,
                Button save
        ) {
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
            save.setAccessibleText(stairGeometry.label() + " Geometrie" + SAVE_ACTION_SUFFIX);
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
            save.setAccessibleText("Narration fuer " + card.roomName() + SAVE_ACTION_SUFFIX);
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
