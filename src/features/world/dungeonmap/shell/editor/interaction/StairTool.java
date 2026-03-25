package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.stair.DungeonStairEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
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
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class StairTool implements EditorTool {

    private static final String READY_MESSAGE = "Zum Platzieren Feld anklicken";
    private static final String MIN_LEVELS_MESSAGE = "Mindestens zwei verschiedene Ebenen";
    private static final String DUPLICATE_MESSAGE = "Ausgänge dürfen nicht doppelt sein";

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonStairEditService stairEditService;
    private final EditorInteractionState state;
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
    private final VBox stairCard = EditorCards.card("Treppen-Ausgänge", stairSummaryLabel, stairEditorContent, stairStatusLabel);

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
    private boolean syncingStairInput;
    private boolean syncingStairShape;
    private boolean syncingStairDimensions;
    private int inputLevel;
    private StairShape shape = StairShape.LADDER;
    private CardinalDirection direction = CardinalDirection.defaultDirection();
    private int dimension1 = 1;
    private int dimension2 = 1;
    private List<Integer> exitLevels = List.of();
    private String statusMessage = MIN_LEVELS_MESSAGE;
    private String placementError;

    public StairTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonStairEditService stairEditService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.stairEditService = Objects.requireNonNull(stairEditService, "stairEditService");
        this.state = Objects.requireNonNull(state, "state");
        initializeStatePane();
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.STAIR_CREATE, DungeonEditorTool.STAIR_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        if (tool == DungeonEditorTool.STAIR_CREATE) {
            resetForLevel(mapState.activeProjectionLevel());
        }
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        clear();
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButton()) {
            return false;
        }
        return switch (sessionState.selectedTool()) {
            case STAIR_CREATE -> handleCreatePressed(event.gridCell());
            case STAIR_DELETE -> handleDeletePressed(event.gridCell());
            default -> false;
        };
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        if (activeTool == null) {
            return null;
        }
        refreshCard();
        if (activeTool != DungeonEditorTool.STAIR_CREATE
                && activeTool != DungeonEditorTool.STAIR_DELETE
                && !DungeonStair.isTargetKey(state.selectedTargetKey())) {
            return null;
        }
        return stairCard;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private boolean handleCreatePressed(Point2i gridCell) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || gridCell == null || !canPlace()) {
            return false;
        }
        state.clearSelection();
        clearPlacementError();
        UiAsyncTasks.submitVoid(
                () -> stairEditService.create(
                        mapState.activeMap(),
                        gridCell,
                        shape,
                        direction,
                        dimension1,
                        dimension2,
                        exitLevels),
                () -> {
                    clearPlacementError();
                    loadingService.reload(mapId);
                },
                throwable -> {
                    showPlacementError(throwable == null ? "Treppe konnte nicht platziert werden" : throwable.getMessage());
                    UiErrorReporter.reportBackgroundFailure("StairTool.handleCreatePressed()", throwable);
                });
        return true;
    }

    private boolean handleDeletePressed(Point2i gridCell) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || gridCell == null) {
            return false;
        }
        DungeonStair stair = mapState.activeMap().stairsAtCell(gridCell, mapState.activeProjectionLevel()).stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null)
                .min(Comparator.comparing(DungeonStair::stairId))
                .orElse(null);
        if (stair == null || stair.stairId() == null) {
            state.clearSelection();
            return false;
        }
        state.selectTarget(stair.targetKey());
        UiAsyncTasks.submitVoid(
                () -> stairEditService.delete(stair.stairId()),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("StairTool.handleDeletePressed()", throwable));
        return true;
    }

    private void clear() {
        if (activeTool != DungeonEditorTool.STAIR_CREATE) {
            clearDraft();
        }
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
                setShape(newValue);
            }
        });
        stairInputField.textProperty().addListener((obs, oldValue, newValue) -> handleStairInputChanged(newValue));
        stairDimension1Field.textProperty().addListener((obs, oldValue, newValue) ->
                handleStairDimensionChanged(newValue, this::setDimension1));
        stairDimension2Field.textProperty().addListener((obs, oldValue, newValue) ->
                handleStairDimensionChanged(newValue, this::setDimension2));
        stairInputField.setOnAction(event -> addExitLevel());
        stairDimension1Field.setOnAction(event -> handleStairDimensionChanged(stairDimension1Field.getText(), this::setDimension1));
        stairDimension2Field.setOnAction(event -> handleStairDimensionChanged(stairDimension2Field.getText(), this::setDimension2));
        stairLevelDownButton.setOnAction(event -> adjustInputLevel(-1));
        stairLevelUpButton.setOnAction(event -> adjustInputLevel(1));
        stairAddButton.setOnAction(event -> addExitLevel());
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
            String selectedTargetKey = state.selectedTargetKey();
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
        stairStatusLabel.setText(displayStatus() == null ? "" : displayStatus());
        stairLevelDownButton.setDisable(false);
        stairLevelUpButton.setDisable(false);
        stairInputField.setDisable(false);
        stairAddButton.setDisable(false);
        stairShapeBox.setDisable(false);
        syncStairShape(shape, direction);
        syncStairDimensions(dimension1, dimension2);
        updateStairShapeVisibility(shape, true);
        syncStairInput(inputLevel);
        renderStairTokens(exitLevels);
    }

    private void handleStairInputChanged(String value) {
        if (syncingStairInput) {
            return;
        }
        if (value == null || value.isBlank() || "-".equals(value.trim())) {
            return;
        }
        try {
            setInputLevel(Integer.parseInt(value.trim()));
        } catch (NumberFormatException ignored) {
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
        }
    }

    private void configureDirectionButton(Button button, CardinalDirection direction) {
        button.getStyleClass().add("compact");
        button.setOnAction(event -> {
            if (!syncingStairShape) {
                setDirection(direction);
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
        removeButton.setOnAction(event -> removeExitLevel(level));
        HBox token = new HBox(4, label, removeButton);
        token.setAlignment(Pos.CENTER_LEFT);
        token.getStyleClass().addAll("chip", "chip-cr");
        return token;
    }

    private String displayStatus() {
        return placementError == null || placementError.isBlank() ? statusMessage : placementError;
    }

    private boolean canPlace() {
        return exitLevels.size() >= 2 && validationMessage() == null;
    }

    private void resetForLevel(int level) {
        List<Integer> nextExitLevels = List.of(level);
        String nextStatusMessage = statusFor(shape, dimension1, dimension2, nextExitLevels);
        if (inputLevel == level
                && exitLevels.equals(nextExitLevels)
                && Objects.equals(statusMessage, nextStatusMessage)) {
            return;
        }
        inputLevel = level;
        exitLevels = nextExitLevels;
        statusMessage = nextStatusMessage;
        placementError = null;
        refreshStatePane();
    }

    private void setInputLevel(int level) {
        if (inputLevel == level && !Objects.equals(statusMessage, DUPLICATE_MESSAGE)) {
            return;
        }
        inputLevel = level;
        if (Objects.equals(statusMessage, DUPLICATE_MESSAGE)) {
            statusMessage = statusFor(shape, dimension1, dimension2, exitLevels);
        }
        placementError = null;
        refreshStatePane();
    }

    private void adjustInputLevel(int delta) {
        if (delta != 0) {
            setInputLevel(inputLevel + delta);
        }
    }

    private void addExitLevel() {
        if (exitLevels.contains(inputLevel)) {
            if (!Objects.equals(statusMessage, DUPLICATE_MESSAGE)) {
                statusMessage = DUPLICATE_MESSAGE;
                refreshStatePane();
            }
            return;
        }
        java.util.ArrayList<Integer> updated = new java.util.ArrayList<>(exitLevels);
        updated.add(inputLevel);
        exitLevels = List.copyOf(updated);
        statusMessage = statusFor(shape, dimension1, dimension2, exitLevels);
        placementError = null;
        refreshStatePane();
    }

    private void setShape(StairShape shape) {
        StairShape nextShape = shape == null ? StairShape.LADDER : shape;
        int nextDimension1 = normalizeDimension1(nextShape, dimension1);
        int nextDimension2 = normalizeDimension2(nextShape, dimension2);
        if (this.shape == nextShape
                && dimension1 == nextDimension1
                && dimension2 == nextDimension2
                && !needsStatusRefresh()) {
            return;
        }
        this.shape = nextShape;
        this.dimension1 = nextDimension1;
        this.dimension2 = nextDimension2;
        refreshStatusAndNotify();
    }

    private void setDirection(CardinalDirection direction) {
        CardinalDirection nextDirection = direction == null ? CardinalDirection.defaultDirection() : direction;
        if (this.direction == nextDirection) {
            return;
        }
        this.direction = nextDirection;
        refreshStatusAndNotify();
    }

    private void setDimension1(int dimension1) {
        if (this.dimension1 == dimension1) {
            return;
        }
        this.dimension1 = dimension1;
        refreshStatusAndNotify();
    }

    private void setDimension2(int dimension2) {
        if (this.dimension2 == dimension2) {
            return;
        }
        this.dimension2 = dimension2;
        refreshStatusAndNotify();
    }

    private void removeExitLevel(int level) {
        if (!exitLevels.contains(level)) {
            return;
        }
        java.util.ArrayList<Integer> updated = new java.util.ArrayList<>(exitLevels);
        updated.remove(Integer.valueOf(level));
        exitLevels = List.copyOf(updated);
        statusMessage = statusFor(shape, dimension1, dimension2, exitLevels);
        placementError = null;
        refreshStatePane();
    }

    private void showPlacementError(String message) {
        String nextMessage = message == null || message.isBlank() ? null : message.trim();
        if (Objects.equals(placementError, nextMessage)) {
            return;
        }
        placementError = nextMessage;
        refreshStatePane();
    }

    private void clearPlacementError() {
        if (placementError == null) {
            return;
        }
        placementError = null;
        refreshStatePane();
    }

    private void clearDraft() {
        if (inputLevel == 0
                && shape == StairShape.LADDER
                && direction == CardinalDirection.defaultDirection()
                && dimension1 == 1
                && dimension2 == 1
                && exitLevels.isEmpty()
                && Objects.equals(statusMessage, MIN_LEVELS_MESSAGE)
                && placementError == null) {
            return;
        }
        inputLevel = 0;
        shape = StairShape.LADDER;
        direction = CardinalDirection.defaultDirection();
        dimension1 = 1;
        dimension2 = 1;
        exitLevels = List.of();
        statusMessage = MIN_LEVELS_MESSAGE;
        placementError = null;
        refreshStatePane();
    }

    private static String statusFor(StairShape shape, int dimension1, int dimension2, List<Integer> levels) {
        if (levels.size() < 2) {
            return MIN_LEVELS_MESSAGE;
        }
        return shape.validateDimensions(dimension1, dimension2).orElse(READY_MESSAGE);
    }

    private String validationMessage() {
        return shape.validateDimensions(dimension1, dimension2).orElse(null);
    }

    private static int normalizeDimension1(StairShape shape, int currentValue) {
        return shape != null && shape != StairShape.LADDER && currentValue <= 0 ? 1 : currentValue;
    }

    private static int normalizeDimension2(StairShape shape, int currentValue) {
        return shape == StairShape.RECTANGULAR && currentValue <= 0 ? 1 : currentValue;
    }

    private boolean needsStatusRefresh() {
        return !Objects.equals(statusMessage, statusFor(shape, dimension1, dimension2, exitLevels));
    }

    private void refreshStatusAndNotify() {
        String nextStatusMessage = statusFor(shape, dimension1, dimension2, exitLevels);
        if (Objects.equals(statusMessage, nextStatusMessage)) {
            placementError = null;
            refreshStatePane();
            return;
        }
        statusMessage = nextStatusMessage;
        placementError = null;
        refreshStatePane();
    }

    private static String stairLabel(String targetKey) {
        Long stairId = DungeonStair.stairIdFromKey(targetKey);
        return stairId == null ? "Treppe" : "Treppe " + stairId;
    }
}
