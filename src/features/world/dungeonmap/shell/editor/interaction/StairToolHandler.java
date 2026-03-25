package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonStairDraftState;
import features.world.dungeonmap.state.EditorSelectionState;
import javafx.collections.FXCollections;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class StairToolHandler implements EditorToolHandler {

    private final StairInteractionController controller;
    private final DungeonMapState mapState;
    private final DungeonStairDraftState stairDraftState;
    private final EditorSelectionState selectionState;
    private final Label stairSummaryLabel = new Label("Keine Treppe gewählt");
    private final ComboBox<StairShape> stairShapeBox = new ComboBox<>();
    private final FlowPane stairDirectionButtons = new FlowPane();
    private final Button stairNorthButton = new Button("N");
    private final Button stairEastButton = new Button("O");
    private final Button stairSouthButton = new Button("S");
    private final Button stairWestButton = new Button("W");
    private final TextField stairDimension1Field = new TextField();
    private final TextField stairDimension2Field = new TextField();
    private final Label stairDimension1Label = new Label("Maß 1");
    private final Label stairDimension2Label = new Label("Maß 2");
    private final HBox stairDimension1Row = new HBox(6, stairDimension1Label, stairDimension1Field);
    private final HBox stairDimension2Row = new HBox(6, stairDimension2Label, stairDimension2Field);
    private final TextField stairInputField = new TextField();
    private final Button stairLevelDownButton = new Button("-");
    private final Button stairLevelUpButton = new Button("+");
    private final Button stairAddButton = new Button("Hinzufügen");
    private final FlowPane stairExitTokens = new FlowPane();
    private final Label stairStatusLabel = new Label();
    private final HBox stairInputRow = new HBox(6, stairInputField, stairLevelDownButton, stairLevelUpButton, stairAddButton);
    private final VBox stairEditorContent = new VBox(
            6,
            stairShapeBox,
            stairDirectionButtons,
            stairDimension1Row,
            stairDimension2Row,
            stairInputRow,
            stairExitTokens);
    private final VBox stairCard = createCard("Treppen-Ausgänge", stairSummaryLabel, stairEditorContent, stairStatusLabel);

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
    private boolean syncingStairInput;
    private boolean syncingStairShape;
    private boolean syncingStairDimensions;

    public StairToolHandler(
            StairInteractionController controller,
            DungeonMapState mapState,
            DungeonStairDraftState stairDraftState,
            EditorSelectionState selectionState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.stairDraftState = Objects.requireNonNull(stairDraftState, "stairDraftState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        initializeStatePane();
        this.selectionState.addListener(this::refreshStatePane);
        this.stairDraftState.addListener(this::refreshStatePane);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.STAIR_CREATE, DungeonEditorTool.STAIR_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        if (tool == DungeonEditorTool.STAIR_CREATE) {
            stairDraftState.resetForLevel(mapState.activeProjectionLevel());
        }
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        controller.clear();
        refreshStatePane();
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        return controller.handlePressed(event);
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return controller.handleDragged(event);
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return controller.handleReleased(event);
    }

    @Override
    public Node statePaneContent() {
        refreshCard();
        if (activeTool != DungeonEditorTool.STAIR_CREATE
                && activeTool != DungeonEditorTool.STAIR_DELETE
                && !DungeonStair.isTargetKey(selectionState.selectedTargetKey())) {
            return null;
        }
        return stairCard;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private void initializeStatePane() {
        stairInputField.setTextFormatter(new TextFormatter<>(change ->
                change.getControlNewText().matches("-?\\d*") ? change : null));
        stairDimension1Field.setTextFormatter(new TextFormatter<>(change ->
                change.getControlNewText().matches("-?\\d*") ? change : null));
        stairDimension2Field.setTextFormatter(new TextFormatter<>(change ->
                change.getControlNewText().matches("-?\\d*") ? change : null));
        stairInputField.setPrefColumnCount(4);
        stairInputField.setMaxWidth(70);
        stairDimension1Field.setPrefColumnCount(4);
        stairDimension1Field.setMaxWidth(70);
        stairDimension2Field.setPrefColumnCount(4);
        stairDimension2Field.setMaxWidth(70);
        stairLevelDownButton.getStyleClass().add("compact");
        stairLevelUpButton.getStyleClass().add("compact");
        stairShapeBox.setItems(FXCollections.observableArrayList(StairShape.values()));
        stairShapeBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(StairShape value) {
                return value == null ? "" : value.label();
            }

            @Override
            public StairShape fromString(String string) {
                return null;
            }
        });
        stairShapeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairShape) {
                stairDraftState.setShape(newValue);
            }
        });
        stairInputField.textProperty().addListener((obs, oldValue, newValue) -> handleStairInputChanged(newValue));
        stairDimension1Field.textProperty().addListener((obs, oldValue, newValue) ->
                handleStairDimensionChanged(newValue, stairDraftState::setDimension1));
        stairDimension2Field.textProperty().addListener((obs, oldValue, newValue) ->
                handleStairDimensionChanged(newValue, stairDraftState::setDimension2));
        stairInputField.setOnAction(event -> stairDraftState.addExitLevel());
        stairDimension1Field.setOnAction(event -> handleStairDimensionChanged(stairDimension1Field.getText(), stairDraftState::setDimension1));
        stairDimension2Field.setOnAction(event -> handleStairDimensionChanged(stairDimension2Field.getText(), stairDraftState::setDimension2));
        stairLevelDownButton.setOnAction(event -> stairDraftState.adjustInputLevel(-1));
        stairLevelUpButton.setOnAction(event -> stairDraftState.adjustInputLevel(1));
        stairAddButton.setOnAction(event -> stairDraftState.addExitLevel());
        stairInputRow.setAlignment(Pos.CENTER_LEFT);
        stairDimension1Row.setAlignment(Pos.CENTER_LEFT);
        stairDimension2Row.setAlignment(Pos.CENTER_LEFT);
        configureDirectionButton(stairNorthButton, CardinalDirection.NORTH);
        configureDirectionButton(stairEastButton, CardinalDirection.EAST);
        configureDirectionButton(stairSouthButton, CardinalDirection.SOUTH);
        configureDirectionButton(stairWestButton, CardinalDirection.WEST);
        stairDirectionButtons.setHgap(6);
        stairDirectionButtons.setVgap(6);
        stairDirectionButtons.getChildren().setAll(stairNorthButton, stairEastButton, stairSouthButton, stairWestButton);
        stairExitTokens.setHgap(6);
        stairExitTokens.setVgap(6);
        stairStatusLabel.setWrapText(true);
        syncStairInput(null);
        syncStairShape(null, CardinalDirection.defaultDirection());
        syncStairDimensions(null, null);
        stairExitTokens.getChildren().clear();
    }

    private void refreshStatePane() {
        refreshCallback.run();
    }

    private void refreshCard() {
        if (activeTool == DungeonEditorTool.STAIR_DELETE) {
            String selectedTargetKey = selectionState.selectedTargetKey();
            String summary = DungeonStair.isTargetKey(selectedTargetKey)
                    ? "Gewählt: " + stairLabel(selectedTargetKey)
                    : "Treppenfeld anklicken, um zu löschen";
            stairSummaryLabel.setText(summary);
            stairEditorContent.setManaged(false);
            stairEditorContent.setVisible(false);
            stairStatusLabel.setText("");
            stairLevelDownButton.setDisable(true);
            stairLevelUpButton.setDisable(true);
            stairInputField.setDisable(true);
            stairAddButton.setDisable(true);
            stairShapeBox.setDisable(true);
            syncStairShape(null, CardinalDirection.defaultDirection());
            syncStairDimensions(null, null);
            syncStairInput(null);
            stairExitTokens.getChildren().clear();
            updateStairShapeVisibility(StairShape.LADDER, false);
            return;
        }
        stairSummaryLabel.setText("Aktuelle Ebene als Ausgang hinzufügen");
        stairEditorContent.setManaged(true);
        stairEditorContent.setVisible(true);
        stairStatusLabel.setText(blankToEmpty(stairDraftState.displayStatus()));
        stairLevelDownButton.setDisable(false);
        stairLevelUpButton.setDisable(false);
        stairInputField.setDisable(false);
        stairAddButton.setDisable(false);
        stairShapeBox.setDisable(false);
        syncStairShape(stairDraftState.shape(), stairDraftState.direction());
        syncStairDimensions(stairDraftState.dimension1(), stairDraftState.dimension2());
        updateStairShapeVisibility(stairDraftState.shape(), true);
        syncStairInput(stairDraftState.inputLevel());
        renderStairTokens(stairDraftState.exitLevels());
    }

    private void handleStairInputChanged(String value) {
        if (syncingStairInput) {
            return;
        }
        if (value == null || value.isBlank() || "-".equals(value.trim())) {
            return;
        }
        try {
            stairDraftState.setInputLevel(Integer.parseInt(value.trim()));
        } catch (NumberFormatException ignored) {
            // The state owner keeps the canonical numeric value and will re-render it on refresh.
        }
    }

    private void syncStairInput(Integer level) {
        syncingStairInput = true;
        stairInputField.setText(level == null ? "" : Integer.toString(level));
        syncingStairInput = false;
    }

    private void syncStairShape(StairShape shape, CardinalDirection direction) {
        syncingStairShape = true;
        stairShapeBox.setValue(shape);
        updateDirectionSelection(direction == null ? CardinalDirection.defaultDirection() : direction);
        syncingStairShape = false;
    }

    private void syncStairDimensions(Integer dimension1, Integer dimension2) {
        syncingStairDimensions = true;
        stairDimension1Field.setText(dimension1 == null ? "" : Integer.toString(dimension1));
        stairDimension2Field.setText(dimension2 == null ? "" : Integer.toString(dimension2));
        syncingStairDimensions = false;
    }

    private void handleStairDimensionChanged(String value, java.util.function.IntConsumer consumer) {
        if (syncingStairDimensions) {
            return;
        }
        if (value == null || value.isBlank() || "-".equals(value.trim())) {
            return;
        }
        try {
            consumer.accept(Integer.parseInt(value.trim()));
        } catch (NumberFormatException ignored) {
            // The state owner keeps the canonical numeric value and will re-render it on refresh.
        }
    }

    private void configureDirectionButton(Button button, CardinalDirection direction) {
        button.getStyleClass().add("compact");
        button.setOnAction(event -> {
            if (!syncingStairShape) {
                stairDraftState.setDirection(direction);
            }
        });
    }

    private void updateDirectionSelection(CardinalDirection selectedDirection) {
        setDirectionButtonSelected(stairNorthButton, selectedDirection == CardinalDirection.NORTH);
        setDirectionButtonSelected(stairEastButton, selectedDirection == CardinalDirection.EAST);
        setDirectionButtonSelected(stairSouthButton, selectedDirection == CardinalDirection.SOUTH);
        setDirectionButtonSelected(stairWestButton, selectedDirection == CardinalDirection.WEST);
    }

    private static void setDirectionButtonSelected(Button button, boolean selected) {
        if (selected) {
            if (!button.getStyleClass().contains("selected")) {
                button.getStyleClass().add("selected");
            }
            return;
        }
        button.getStyleClass().remove("selected");
    }

    private void updateStairShapeVisibility(StairShape shape, boolean editable) {
        StairShape resolvedShape = shape == null ? StairShape.LADDER : shape;
        boolean showDirection = editable && resolvedShape.needsDirection();
        stairDirectionButtons.setManaged(showDirection);
        stairDirectionButtons.setVisible(showDirection);
        stairDimension1Label.setText(stairDimension1Label(resolvedShape));
        stairDimension2Label.setText("Tiefe");
        boolean showDimension1 = editable && (resolvedShape.needsSideLength()
                || resolvedShape.needsDimensions()
                || resolvedShape.needsRadius());
        boolean showDimension2 = editable && resolvedShape.needsDimensions();
        stairDimension1Row.setManaged(showDimension1);
        stairDimension1Row.setVisible(showDimension1);
        stairDimension2Row.setManaged(showDimension2);
        stairDimension2Row.setVisible(showDimension2);
    }

    private static String stairDimension1Label(StairShape shape) {
        if (shape == StairShape.SQUARE) {
            return "Seitenlänge";
        }
        if (shape == StairShape.RECTANGULAR) {
            return "Breite";
        }
        if (shape == StairShape.CIRCULAR) {
            return "Radius";
        }
        return "Maß";
    }

    private void renderStairTokens(List<Integer> exitLevels) {
        stairExitTokens.getChildren().clear();
        for (Integer level : exitLevels == null ? List.<Integer>of() : exitLevels) {
            if (level != null) {
                stairExitTokens.getChildren().add(createStairToken(level));
            }
        }
    }

    private Node createStairToken(int level) {
        Label label = new Label("z=" + level);
        Button removeButton = new Button("x");
        removeButton.getStyleClass().add("chip-remove-btn");
        removeButton.setOnAction(event -> stairDraftState.removeExitLevel(level));
        HBox token = new HBox(4, label, removeButton);
        token.setAlignment(Pos.CENTER_LEFT);
        token.getStyleClass().addAll("chip", "chip-cr");
        return token;
    }

    private static String blankToEmpty(String text) {
        return text == null ? "" : text;
    }

    private static String stairLabel(String targetKey) {
        Long stairId = DungeonStair.stairIdFromKey(targetKey);
        return stairId == null ? "Treppe" : "Treppe " + stairId;
    }

    private static VBox createCard(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }
}
