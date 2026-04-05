package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.application.stair.DungeonStairApplicationService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.collections.FXCollections;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class ConnectionsTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonRoomApplicationService roomApplicationService;
    private final DungeonCorridorApplicationService corridorApplicationService;
    private final DungeonStairApplicationService stairApplicationService;
    private final EditorInteractionState state;

    private final ComboBox<ConnectionsMode> modeBox = new ComboBox<>();
    private final Label statusLabel = new Label();
    private final Label selectionLabel = new Label();
    private final Label connectedRoomsLabel = new Label();
    private final VBox corridorBox = new VBox(6, statusLabel, selectionLabel, connectedRoomsLabel);

    private final Label stairSummaryLabel = new Label("Keine Treppe gewählt");
    private final Label stairAnchorLabel = new Label("Kein Treppenstart");
    private final TextField stairNameField = new TextField();
    private final ComboBox<StairShape> stairShapeBox = new ComboBox<>();
    private final ComboBox<CardinalDirection> stairDirectionBox = new ComboBox<>();
    private final TextField stairDimension1Field = new TextField();
    private final TextField stairDimension2Field = new TextField();
    private final TextField stairMinLevelField = new TextField();
    private final TextField stairMaxLevelField = new TextField();
    private final FlowPane stairStopButtons = new FlowPane();
    private final Button stairApplyButton = new Button("Übernehmen");
    private final Button stairCancelButton = new Button("Abbrechen");
    private final Label stairStatusLabel = new Label();
    private final Label stairStopLabel = new Label("Verbindungen");
    private final HBox stairLevelRow = new HBox(6, new Label("Min z"), stairMinLevelField, new Label("Max z"), stairMaxLevelField);
    private final HBox stairDimensionRow = new HBox(6, stairDimension1Field, stairDimension2Field);
    private final HBox stairActionRow = new HBox(6, stairApplyButton, stairCancelButton);
    private final VBox stairFormBox = new VBox(
            6,
            stairNameField,
            stairShapeBox,
            stairDirectionBox,
            stairDimensionRow,
            stairLevelRow,
            stairStopLabel,
            stairStopButtons,
            stairActionRow);
    private final VBox stairBox = new VBox(6, stairSummaryLabel, stairAnchorLabel, stairFormBox, stairStatusLabel);
    private final VBox card = EditorCards.card("Connections", modeBox, corridorBox, stairBox);

    private PendingEndpoint pendingEndpoint;
    private ConnectionsMode connectionsMode = ConnectionsMode.CONNECTIONS;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
    private boolean syncingModeField;
    private boolean syncingStairFields;
    private Long previousMapId;

    private Long stairDraftId;
    private CellCoord stairAnchorCell;
    private Integer stairAnchorLevelZ;
    private final LinkedHashSet<Integer> stairStopLevels = new LinkedHashSet<>();
    private boolean stairDraftDirty;
    private boolean stairDraftLoading;
    private long stairLoadRequestSequence;
    private String stairStatusOverride;

    public ConnectionsTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonRoomApplicationService roomApplicationService,
            DungeonCorridorApplicationService corridorApplicationService,
            DungeonStairApplicationService stairApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
        this.corridorApplicationService = Objects.requireNonNull(corridorApplicationService, "corridorApplicationService");
        this.stairApplicationService = Objects.requireNonNull(stairApplicationService, "stairApplicationService");
        this.state = Objects.requireNonNull(state, "state");
        initializeStatePane();
        clearStairDraftState(false);
        this.state.addListener(this::refreshStatePane);
        this.mapState.addListener(this::refreshFromMapState);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.CONNECTIONS, DungeonEditorTool.CONNECTIONS_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        if (tool == DungeonEditorTool.CONNECTIONS_DELETE) {
            pendingEndpoint = null;
            state.clearPreview();
        } else if (connectionsMode == ConnectionsMode.STAIR) {
            refreshStairPreview();
        }
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        pendingEndpoint = null;
        clearStairDraftState(false);
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButton()) {
            return false;
        }
        if (connectionsMode == ConnectionsMode.STAIR) {
            return activeTool == DungeonEditorTool.CONNECTIONS_DELETE
                    ? handleStairDeletePressed(ctx)
                    : handleStairCreatePressed(ctx);
        }
        DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
        DungeonLayout layout = ctx == null ? null : ctx.activeMap();
        if (sessionState.selectedTool() == DungeonEditorTool.CONNECTIONS_DELETE) {
            return handleDeletePressed(ctx, layout, hit);
        }
        return handleConnectionsPressed(ctx, layout, hit);
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
    public EditorHitResolution resolveHit(EditorToolContext ctx, EditorToolPhase phase) {
        if (connectionsMode == ConnectionsMode.STAIR) {
            return resolveStairHit(ctx);
        }
        DungeonSelectionRef hitRef = resolvedHitRef(
                ctx == null ? null : ctx.snapshot(),
                ctx == null ? null : ctx.activeMap(),
                ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ());
        if (hitRef == null) {
            return EditorHitResolution.none();
        }
        if (hitRef instanceof DungeonSelectionRef.RoomBoundaryRef
                || hitRef instanceof DungeonSelectionRef.ConnectionRef
                || hitRef instanceof DungeonSelectionRef.CorridorTileRef
                || hitRef instanceof DungeonSelectionRef.CorridorNodeRef
                || hitRef instanceof DungeonSelectionRef.CorridorSegmentRef) {
            return EditorHitResolution.part(hitRef);
        }
        if (hitRef instanceof DungeonSelectionRef.RoomRef || hitRef instanceof DungeonSelectionRef.CorridorRef) {
            return EditorHitResolution.owner(hitRef);
        }
        return EditorHitResolution.ref(hitRef);
    }

    @Override
    public Node statePaneContent() {
        if (activeTool == null) {
            return null;
        }
        syncModeField();
        renderCorridorPane();
        renderStairPane();
        boolean stairMode = connectionsMode == ConnectionsMode.STAIR;
        corridorBox.setManaged(!stairMode);
        corridorBox.setVisible(!stairMode);
        stairBox.setManaged(stairMode);
        stairBox.setVisible(stairMode);
        return card;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private void initializeStatePane() {
        statusLabel.setWrapText(true);
        selectionLabel.setWrapText(true);
        connectedRoomsLabel.setWrapText(true);
        stairSummaryLabel.setWrapText(true);
        stairAnchorLabel.setWrapText(true);
        stairStatusLabel.setWrapText(true);
        stairStopButtons.setHgap(6);
        stairStopButtons.setVgap(6);
        stairNameField.setPromptText("Name");
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
        stairDirectionBox.setItems(FXCollections.observableArrayList(CardinalDirection.values()));
        stairDirectionBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(CardinalDirection value) {
                return value == null ? "" : value.label();
            }

            @Override
            public CardinalDirection fromString(String string) {
                return null;
            }
        });
        modeBox.setItems(FXCollections.observableArrayList(ConnectionsMode.values()));
        modeBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(ConnectionsMode value) {
                return value == null ? "" : value.label();
            }

            @Override
            public ConnectionsMode fromString(String string) {
                return null;
            }
        });
        modeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingModeField) {
                setConnectionsMode(newValue);
            }
        });
        stairShapeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged(false);
            }
        });
        stairDirectionBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged(false);
            }
        });
        stairNameField.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged(false);
            }
        });
        stairDimension1Field.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged(false);
            }
        });
        stairDimension2Field.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged(false);
            }
        });
        stairMinLevelField.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged(true);
            }
        });
        stairMaxLevelField.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged(true);
            }
        });
        stairApplyButton.setOnAction(event -> commitStairDraft());
        stairCancelButton.setOnAction(event -> cancelStairDraft());
    }

    private void renderCorridorPane() {
        Corridor corridor = selectedCorridor();
        statusLabel.setText(statusText());
        selectionLabel.setText(selectionText(corridor));
        connectedRoomsLabel.setText(connectedRoomsText(corridor));
    }

    private void renderStairPane() {
        StairDraftResolution resolution = resolveCurrentStairDraft(true);
        boolean createMode = activeTool == DungeonEditorTool.CONNECTIONS;
        stairSummaryLabel.setText(stairSummaryText());
        stairAnchorLabel.setText(stairAnchorText());
        stairFormBox.setManaged(createMode);
        stairFormBox.setVisible(createMode);
        StairShape shape = currentStairShape();
        boolean showDirection = shape.needsDirection();
        stairDirectionBox.setManaged(showDirection);
        stairDirectionBox.setVisible(showDirection);
        configureDimensionFields(shape);
        renderStopButtons();
        stairApplyButton.setDisable(!createMode || stairDraftLoading || stairAnchorCell == null);
        stairCancelButton.setDisable(stairDraftLoading || (stairAnchorCell == null && stairDraftId == null));
        stairStatusLabel.setText(stairStatusText(resolution, createMode));
    }

    private void configureDimensionFields(StairShape shape) {
        StairShape resolvedShape = shape == null ? StairShape.LADDER : shape;
        boolean showDimension1 = resolvedShape.needsSideLength() || resolvedShape.needsDimensions() || resolvedShape.needsRadius();
        boolean showDimension2 = resolvedShape.needsDimensions();
        stairDimension1Field.setManaged(showDimension1);
        stairDimension1Field.setVisible(showDimension1);
        stairDimension2Field.setManaged(showDimension2);
        stairDimension2Field.setVisible(showDimension2);
        stairDimensionRow.setManaged(showDimension1 || showDimension2);
        stairDimensionRow.setVisible(showDimension1 || showDimension2);
        stairDimension1Field.setPromptText(switch (resolvedShape) {
            case SQUARE -> "Seitenlänge";
            case RECTANGULAR -> "Breite";
            case CIRCULAR -> "Radius";
            case LADDER, STRAIGHT -> "";
        });
        stairDimension2Field.setPromptText(resolvedShape == StairShape.RECTANGULAR ? "Tiefe" : "");
    }

    private void renderStopButtons() {
        stairStopButtons.getChildren().clear();
        Integer minLevel = parseInteger(stairMinLevelField.getText());
        Integer maxLevel = parseInteger(stairMaxLevelField.getText());
        if (minLevel == null || maxLevel == null || minLevel > maxLevel) {
            return;
        }
        stairStopLevels.removeIf(level -> level == null || level < minLevel || level > maxLevel);
        if (stairAnchorLevelZ != null && stairAnchorLevelZ >= minLevel && stairAnchorLevelZ <= maxLevel) {
            stairStopLevels.add(stairAnchorLevelZ);
        }
        for (int level = minLevel; level <= maxLevel; level++) {
            ToggleButton button = new ToggleButton("z=" + level);
            button.setSelected(stairStopLevels.contains(level));
            boolean anchorLevel = Objects.equals(stairAnchorLevelZ, level);
            button.setDisable(anchorLevel || stairDraftLoading || activeTool != DungeonEditorTool.CONNECTIONS);
            if (anchorLevel && !button.getStyleClass().contains("selected")) {
                button.getStyleClass().add("selected");
            }
            int buttonLevel = level;
            button.setOnAction(event -> toggleStopLevel(buttonLevel, button.isSelected()));
            stairStopButtons.getChildren().add(button);
        }
    }

    private void toggleStopLevel(int level, boolean selected) {
        clearStairStatusOverride();
        if (selected) {
            stairStopLevels.add(level);
        } else {
            stairStopLevels.remove(level);
        }
        stairDraftDirty = true;
        refreshStairPreview();
        refreshStatePane();
    }

    private void syncModeField() {
        syncingModeField = true;
        modeBox.setValue(connectionsMode);
        syncingModeField = false;
    }

    private void setConnectionsMode(ConnectionsMode mode) {
        ConnectionsMode next = mode == null ? ConnectionsMode.CONNECTIONS : mode;
        if (connectionsMode == next) {
            syncModeField();
            return;
        }
        connectionsMode = next;
        clearStairStatusOverride();
        if (next == ConnectionsMode.CONNECTIONS) {
            clearStairDraftState(false);
        } else {
            pendingEndpoint = null;
        }
        if (activeTool == DungeonEditorTool.CONNECTIONS && next == ConnectionsMode.STAIR) {
            refreshStairPreview();
        } else {
            state.clearPreview();
        }
        refreshStatePane();
    }

    private void onStairFieldChanged(boolean rebuildStops) {
        clearStairStatusOverride();
        if (stairAnchorCell == null || stairDraftLoading) {
            refreshStatePane();
            return;
        }
        stairDraftDirty = true;
        if (rebuildStops) {
            renderStopButtons();
        }
        refreshStairPreview();
        refreshStatePane();
    }

    private void refreshFromMapState() {
        boolean mapChanged = !Objects.equals(previousMapId, mapState.activeMapId());
        previousMapId = mapState.activeMapId();
        if (mapChanged) {
            pendingEndpoint = null;
            clearStairDraftState(false);
        }
        if (stairDraftId != null && mapState.activeMap().findStair(stairDraftId) == null) {
            clearStairDraftState(false);
        }
        if (activeTool == DungeonEditorTool.CONNECTIONS && connectionsMode == ConnectionsMode.STAIR) {
            refreshStairPreview();
        }
        refreshStatePane();
    }

    private EditorHitResolution resolveStairHit(EditorToolContext ctx) {
        features.world.dungeonmap.shell.interaction.DungeonHitSnapshot snapshot = ctx == null ? null : ctx.snapshot();
        DungeonSelectionRef stairRef = snapshot == null
                ? null
                : snapshot.firstRefMatching(candidate -> candidate instanceof DungeonSelectionRef.StairRef);
        if (stairRef != null) {
            return EditorHitResolution.owner(stairRef);
        }
        if (activeTool == DungeonEditorTool.CONNECTIONS_DELETE || ctx == null || ctx.probe() == null) {
            return EditorHitResolution.none();
        }
        DungeonLayout layout = ctx.activeMap();
        CellCoord gridCell = ctx.probe().gridCell();
        int levelZ = ctx.probe().levelZ();
        if (layout == null || layout.roomAtCell(gridCell, levelZ) == null) {
            return EditorHitResolution.none();
        }
        return EditorHitResolution.part(new DungeonSelectionRef.FloorCellRef(CubePoint.at(gridCell, levelZ)));
    }

    private boolean handleStairCreatePressed(EditorToolContext ctx) {
        DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
        if (hit instanceof DungeonSelectionRef.StairRef stairRef && stairRef.stairId() != null) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            loadStairEditor(stairRef.stairId());
            return true;
        }
        if (!(hit instanceof DungeonSelectionRef.FloorCellRef floorCellRef)) {
            return false;
        }
        applySelection(ctx == null ? null : ctx.resolvedRef());
        startNewStair(floorCellRef.cell().projectedCell(), floorCellRef.cell().z());
        return true;
    }

    private boolean handleStairDeletePressed(EditorToolContext ctx) {
        DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
        if (!(hit instanceof DungeonSelectionRef.StairRef stairRef) || stairRef.stairId() == null) {
            return false;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return false;
        }
        applySelection(ctx == null ? null : ctx.resolvedRef());
        loadingService.submitMutation(
                () -> {
                    stairApplicationService.deleteStair(new DungeonStairApplicationService.DeleteStairRequest(mapId, stairRef.stairId()));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    if (Objects.equals(stairDraftId, stairRef.stairId())) {
                        clearStairDraftState(false);
                    }
                    state.clearSelection();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.handleStairDeletePressed()", throwable));
        return true;
    }

    private void startNewStair(CellCoord cell, int levelZ) {
        stairLoadRequestSequence++;
        stairDraftLoading = false;
        stairDraftId = null;
        stairAnchorCell = cell;
        stairAnchorLevelZ = levelZ;
        stairDraftDirty = true;
        stairStopLevels.clear();
        stairStopLevels.add(levelZ);
        clearStairStatusOverride();
        setStairFields(
                null,
                StairShape.LADDER,
                CardinalDirection.defaultDirection(),
                levelZ,
                levelZ,
                2,
                2,
                stairStopLevels);
        refreshStairPreview();
        refreshStatePane();
    }

    private void loadStairEditor(long stairId) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || stairId <= 0) {
            return;
        }
        stairDraftLoading = true;
        stairDraftDirty = false;
        stairDraftId = stairId;
        clearStairStatusOverride();
        state.clearPreview();
        refreshStatePane();
        long requestId = ++stairLoadRequestSequence;
        UiAsyncTasks.submit(
                () -> stairApplicationService.loadStairEditorSpec(
                        new DungeonStairApplicationService.LoadStairEditorSpecRequest(mapId, stairId)),
                spec -> {
                    if (requestId != stairLoadRequestSequence
                            || connectionsMode != ConnectionsMode.STAIR
                            || !Objects.equals(mapState.activeMapId(), mapId)) {
                        return;
                    }
                    if (spec == null) {
                        stairDraftLoading = false;
                        stairStatusOverride = "Treppendaten konnten nicht geladen werden";
                        refreshStatePane();
                        return;
                    }
                    stairDraftLoading = false;
                    stairDraftId = spec.stairId();
                    stairAnchorCell = spec.anchorCell();
                    stairAnchorLevelZ = spec.anchorLevelZ();
                    stairDraftDirty = false;
                    clearStairStatusOverride();
                    setStairFields(
                            spec.name(),
                            spec.shape(),
                            spec.direction(),
                            spec.minLevelZ(),
                            spec.maxLevelZ(),
                            spec.dimension1(),
                            spec.dimension2(),
                            spec.stopLevels());
                    state.clearPreview();
                    refreshStatePane();
                },
                throwable -> {
                    if (requestId != stairLoadRequestSequence) {
                        return;
                    }
                    stairDraftLoading = false;
                    stairStatusOverride = "Treppendaten konnten nicht geladen werden";
                    UiErrorReporter.reportBackgroundFailure("ConnectionsTool.loadStairEditor()", throwable);
                    refreshStatePane();
                });
    }

    private void setStairFields(
            String name,
            StairShape shape,
            CardinalDirection direction,
            int minLevel,
            int maxLevel,
            int dimension1,
            int dimension2,
            Set<Integer> stopLevels
    ) {
        syncingStairFields = true;
        stairNameField.setText(name == null ? "" : name);
        stairShapeBox.setValue(shape == null ? StairShape.LADDER : shape);
        stairDirectionBox.setValue(direction == null ? CardinalDirection.defaultDirection() : direction);
        stairMinLevelField.setText(Integer.toString(minLevel));
        stairMaxLevelField.setText(Integer.toString(maxLevel));
        stairDimension1Field.setText(Integer.toString(dimension1));
        stairDimension2Field.setText(Integer.toString(dimension2));
        stairStopLevels.clear();
        for (Integer stopLevel : stopLevels == null ? Set.<Integer>of() : stopLevels) {
            if (stopLevel != null) {
                stairStopLevels.add(stopLevel);
            }
        }
        if (stairAnchorLevelZ != null && stairAnchorLevelZ >= minLevel && stairAnchorLevelZ <= maxLevel) {
            stairStopLevels.add(stairAnchorLevelZ);
        }
        syncingStairFields = false;
    }

    private void commitStairDraft() {
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        StairDraftResolution resolution = resolveCurrentStairDraft(false);
        if (resolution.draft() == null) {
            stairStatusOverride = resolution.validationMessage();
            refreshStatePane();
            return;
        }
        clearStairStatusOverride();
        if (stairDraftId == null) {
            loadingService.submitMutation(
                    () -> stairApplicationService.createStair(
                            new DungeonStairApplicationService.CreateStairRequest(mapId, resolution.draft())),
                    createdId -> mapId,
                    createdId -> {
                        stairDraftId = createdId;
                        stairDraftDirty = false;
                        state.clearPreview();
                        state.selectRef(stairOwnerRef(createdId));
                    },
                    throwable -> {
                        stairStatusOverride = throwable == null || throwable.getMessage() == null
                                ? "Treppe konnte nicht erstellt werden"
                                : throwable.getMessage();
                        UiErrorReporter.reportBackgroundFailure("ConnectionsTool.commitStairDraft()", throwable);
                    });
            return;
        }
        long stairId = stairDraftId;
        loadingService.submitMutation(
                () -> {
                    stairApplicationService.updateStair(
                            new DungeonStairApplicationService.UpdateStairRequest(mapId, stairId, resolution.draft()));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    stairDraftDirty = false;
                    state.clearPreview();
                    state.selectRef(stairOwnerRef(stairId));
                },
                throwable -> {
                    stairStatusOverride = throwable == null || throwable.getMessage() == null
                            ? "Treppe konnte nicht aktualisiert werden"
                            : throwable.getMessage();
                    UiErrorReporter.reportBackgroundFailure("ConnectionsTool.commitStairDraft()", throwable);
                });
    }

    private void cancelStairDraft() {
        Long selectedStairId = stairDraftId;
        clearStairDraftState(false);
        if (selectedStairId != null) {
            state.selectRef(stairOwnerRef(selectedStairId));
        } else {
            state.clearSelection();
        }
        refreshStatePane();
    }

    private void clearStairDraftState(boolean clearSelection) {
        stairLoadRequestSequence++;
        stairDraftLoading = false;
        stairDraftDirty = false;
        stairDraftId = null;
        stairAnchorCell = null;
        stairAnchorLevelZ = null;
        stairStopLevels.clear();
        clearStairStatusOverride();
        syncingStairFields = true;
        stairNameField.setText("");
        stairShapeBox.setValue(StairShape.LADDER);
        stairDirectionBox.setValue(CardinalDirection.defaultDirection());
        stairMinLevelField.setText("");
        stairMaxLevelField.setText("");
        stairDimension1Field.setText("2");
        stairDimension2Field.setText("2");
        syncingStairFields = false;
        state.clearPreview();
        if (clearSelection) {
            state.clearSelection();
        }
    }

    private void clearStairStatusOverride() {
        stairStatusOverride = null;
    }

    private void refreshStairPreview() {
        if (connectionsMode != ConnectionsMode.STAIR
                || activeTool != DungeonEditorTool.CONNECTIONS
                || stairDraftLoading
                || stairAnchorCell == null
                || !stairDraftDirty) {
            state.clearPreview();
            return;
        }
        StairDraftResolution resolution = resolveCurrentStairDraft(true);
        DungeonStair previewStair = resolution.previewStair();
        Long mapId = mapState.activeMapId();
        if (previewStair == null || mapId == null) {
            state.clearPreview();
            return;
        }
        DungeonLayout layout = mapState.activeMap();
        DungeonLayout previewLayout = stairDraftId == null
                ? layout.withAddedStair(previewStair)
                : layout.withUpdatedStair(previewStair);
        state.showPreview(new EditorPreview.LayoutPreview(previewLayout));
    }

    private StairDraftResolution resolveCurrentStairDraft(boolean allowSingleStop) {
        if (stairAnchorCell == null || stairAnchorLevelZ == null) {
            return new StairDraftResolution(null, null, "Raum-Floor-Tile anklicken.");
        }
        Integer minLevel = parseInteger(stairMinLevelField.getText());
        if (minLevel == null) {
            return new StairDraftResolution(null, null, "Min z ist ungültig");
        }
        Integer maxLevel = parseInteger(stairMaxLevelField.getText());
        if (maxLevel == null) {
            return new StairDraftResolution(null, null, "Max z ist ungültig");
        }
        if (minLevel > maxLevel) {
            return new StairDraftResolution(null, null, "Treppenspanne ist ungültig");
        }
        StairShape shape = currentStairShape();
        CardinalDirection direction = currentDirection();
        int dimension1 = resolvedDimension(stairDimension1Field.getText(), shape.needsSideLength() || shape.needsDimensions() || shape.needsRadius());
        int dimension2 = resolvedDimension(stairDimension2Field.getText(), shape.needsDimensions());
        String dimensionError = shape.validateDimensions(dimension1, dimension2).orElse(null);
        if (dimensionError != null) {
            return new StairDraftResolution(null, null, dimensionError);
        }
        if (stairAnchorLevelZ < minLevel || stairAnchorLevelZ > maxLevel) {
            return new StairDraftResolution(null, null, "Start-Ebene liegt außerhalb der Treppenspanne");
        }
        LinkedHashSet<Integer> stopLevels = stairStopLevels.stream()
                .filter(level -> level != null && level >= minLevel && level <= maxLevel)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!stopLevels.contains(stairAnchorLevelZ)) {
            return new StairDraftResolution(null, null, "Start-Ebene muss Teil der Verbindungen bleiben");
        }
        if (!allowSingleStop && stopLevels.size() < 2) {
            return new StairDraftResolution(null, null, "Mindestens eine weitere Ebene wählen");
        }
        DungeonStairApplicationService.StairDraft draft = new DungeonStairApplicationService.StairDraft(
                normalizedName(stairNameField.getText()),
                stairAnchorCell,
                stairAnchorLevelZ,
                shape,
                direction,
                minLevel,
                maxLevel,
                dimension1,
                dimension2,
                stopLevels);
        try {
            DungeonStair previewStair = DungeonStair.resolved(
                    stairDraftId,
                    mapState.activeMapId() == null ? 0L : mapState.activeMapId(),
                    draft.name(),
                    StairPathGenerator.generateAnchoredPath(
                            draft.shape(),
                            draft.anchorCell(),
                            draft.anchorLevelZ(),
                            draft.direction(),
                            draft.minLevelZ(),
                            draft.maxLevelZ(),
                            draft.dimension1(),
                            draft.dimension2()),
                    draft.stopLevels());
            String status = stopLevels.size() < 2
                    ? "Mindestens eine weitere Ebene wählen"
                    : stairDraftDirty
                    ? "Zum Speichern Übernehmen."
                    : "Treppe geladen.";
            return new StairDraftResolution(draft, previewStair, status);
        } catch (IllegalArgumentException ex) {
            return new StairDraftResolution(null, null, ex.getMessage());
        }
    }

    private static int resolvedDimension(String value, boolean required) {
        Integer parsed = parseInteger(value);
        if (parsed == null) {
            return required ? 0 : 0;
        }
        return parsed;
    }

    private static Integer parseInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private StairShape currentStairShape() {
        StairShape shape = stairShapeBox.getValue();
        return shape == null ? StairShape.LADDER : shape;
    }

    private CardinalDirection currentDirection() {
        CardinalDirection direction = stairDirectionBox.getValue();
        return direction == null ? CardinalDirection.defaultDirection() : direction;
    }

    private String stairSummaryText() {
        if (stairDraftLoading) {
            return "Treppendaten werden geladen";
        }
        if (activeTool == DungeonEditorTool.CONNECTIONS_DELETE) {
            return state.selectedRef() instanceof DungeonSelectionRef.StairRef stairRef && stairRef.stairId() != null
                    ? "Löschen: Treppe " + stairRef.stairId()
                    : "Treppe löschen";
        }
        if (stairDraftId != null) {
            return "Bearbeiten: Treppe " + stairDraftId;
        }
        return stairAnchorCell == null ? "Neue Treppe" : "Neue Treppe";
    }

    private String stairAnchorText() {
        if (stairAnchorCell == null || stairAnchorLevelZ == null) {
            return "Kein Treppenstart";
        }
        return "Start: " + stairAnchorCell.x() + "," + stairAnchorCell.y() + " · z=" + stairAnchorLevelZ;
    }

    private String stairStatusText(StairDraftResolution resolution, boolean createMode) {
        if (stairStatusOverride != null && !stairStatusOverride.isBlank()) {
            return stairStatusOverride;
        }
        if (stairDraftLoading) {
            return "Treppendaten werden geladen";
        }
        if (!createMode) {
            return "Treppe anklicken.";
        }
        return resolution.validationMessage();
    }

    private boolean handleConnectionsPressed(EditorToolContext ctx, DungeonLayout layout, DungeonSelectionRef hit) {
        if (layout == null || hit == null) {
            return false;
        }
        int levelZ = ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ();
        if (hit instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundaryHit) {
            DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(roomBoundaryHit, levelZ);
            if (boundary == null) {
                return false;
            }
            if (isEditableDoorBoundary(roomBoundaryHit, boundary, layout, levelZ)) {
                applySelection(ctx == null ? null : ctx.resolvedRef());
                applyDoorEdit(boundary.clusterId(), roomBoundaryHit.boundarySegment2x(), false, ctx == null ? null : ctx.resolvedRef());
                return true;
            }
            if (!boundary.exterior()) {
                return false;
            }
            applySelection(ctx == null ? null : ctx.resolvedRef());
            CorridorEndpoint endpoint = corridorEndpoint(roomBoundaryHit, boundary);
            if (pendingEndpoint instanceof PendingTile pendingTile) {
                attachDoorToTile(endpoint, pendingTile);
                return true;
            }
            if (pendingEndpoint instanceof PendingDoor pendingDoor) {
                createDoorToDoor(pendingDoor.endpoint(), endpoint);
                return true;
            }
            pendingEndpoint = new PendingDoor(endpoint);
            refreshStatePane();
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorTileRef corridorTileHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            PendingTile pendingTile = new PendingTile(
                    corridorTileHit.corridorId(),
                    corridorTileHit.cell().projectedCell());
            if (pendingEndpoint instanceof PendingDoor pendingDoor) {
                attachDoorToTile(pendingDoor.endpoint(), pendingTile);
                return true;
            }
            pendingEndpoint = pendingTile;
            refreshStatePane();
            return true;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef
                || hit instanceof DungeonSelectionRef.CorridorRef
                || hit instanceof DungeonSelectionRef.RoomRef
                || hit instanceof DungeonSelectionRef.CorridorNodeRef
                || hit instanceof DungeonSelectionRef.CorridorSegmentRef) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            return true;
        }
        return false;
    }

    private boolean handleDeletePressed(EditorToolContext ctx, DungeonLayout layout, DungeonSelectionRef hit) {
        if (layout == null || hit == null) {
            return false;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef connectionHit
                && connectionHit.connectionKind() == ConnectionKind.LOCAL) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            applyDoorEdit(
                    connectionHit.clusterId(),
                    connectionHit.boundarySegment2x(),
                    true,
                    clusterOwnerRef(connectionHit.clusterId()));
            return true;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef connectionHit
                && connectionHit.connectionKind() == ConnectionKind.CORRIDOR
                && connectionHit.corridorId() != null) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            deleteCorridorDoor(connectionHit.corridorId(), connectionHit.boundarySegment2x());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorNodeRef corridorNodeHit
                && corridorNodeHit.corridorId() != null
                && corridorNodeHit.nodeId() != null) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            deleteCorridorNode(corridorNodeHit.corridorId(), corridorNodeHit.nodeId());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorSegmentRef corridorSegmentHit
                && corridorSegmentHit.corridorId() != null
                && corridorSegmentHit.segmentId() != null) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            deleteCorridorSegment(corridorSegmentHit.corridorId(), corridorSegmentHit.segmentId());
            return true;
        }
        return false;
    }

    private void createDoorToDoor(CorridorEndpoint start, CorridorEndpoint end) {
        if (start == null || end == null) {
            return;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> corridorApplicationService.createDoorToDoor(new DungeonCorridorApplicationService.CreateDoorToDoorRequest(
                        mapId,
                        mapState.activeProjectionLevel(),
                        start.asRequestEndpoint(),
                        end.asRequestEndpoint())),
                createdId -> mapId,
                createdId -> {
                    clearPendingEndpoint();
                    state.selectRef(corridorOwnerRef(createdId));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.createDoorToDoor()", throwable));
    }

    private void attachDoorToTile(CorridorEndpoint endpoint, PendingTile pendingTile) {
        if (endpoint == null || pendingTile == null || pendingTile.corridorId() == null || pendingTile.tileCell() == null) {
            return;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.attachDoorToCorridorTile(new DungeonCorridorApplicationService.AttachDoorToCorridorTileRequest(
                            mapId,
                            pendingTile.corridorId(),
                            mapState.activeProjectionLevel(),
                            endpoint.asRequestEndpoint(),
                            pendingTile.tileCell()));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    clearPendingEndpoint();
                    state.selectRef(corridorOwnerRef(pendingTile.corridorId()));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.attachDoorToTile()", throwable));
    }

    private void deleteCorridorNode(Long corridorId, Long nodeId) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || corridorId == null || nodeId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.deleteNode(new DungeonCorridorApplicationService.DeleteCorridorNodeRequest(
                            mapId,
                            corridorId,
                            nodeId));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteCorridorNode()", throwable));
    }

    private void deleteCorridorSegment(Long corridorId, Long segmentId) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || corridorId == null || segmentId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.deleteSegment(new DungeonCorridorApplicationService.DeleteCorridorSegmentRequest(
                            mapId,
                            corridorId,
                            segmentId));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteCorridorSegment()", throwable));
    }

    private void deleteCorridorDoor(Long corridorId, GridSegment2x boundarySegment2x) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || corridorId == null || boundarySegment2x == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.deleteDoor(new DungeonCorridorApplicationService.DeleteCorridorDoorRequest(
                            mapId,
                            corridorId,
                            boundarySegment2x));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteCorridorDoor()", throwable));
    }

    private void applyDoorEdit(
            Long clusterId,
            GridSegment2x segment2x,
            boolean deleteBoundary,
            DungeonSelectionRef followUpRef
    ) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || clusterId == null || segment2x == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    if (deleteBoundary) {
                        roomApplicationService.deleteDoor(
                                mapId,
                                clusterId,
                                mapState.activeProjectionLevel(),
                                List.of(segment2x));
                    } else {
                        roomApplicationService.createDoor(
                                mapId,
                                clusterId,
                                mapState.activeProjectionLevel(),
                                List.of(segment2x));
                    }
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectRef(followUpRef),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.applyDoorEdit()", throwable));
    }

    private boolean isEditableDoorBoundary(
            DungeonSelectionRef.RoomBoundaryRef hit,
            DungeonLayout.RoomBoundaryDescription boundary,
            DungeonLayout layout,
            int levelZ
    ) {
        if (hit == null || boundary == null || layout == null || boundary.clusterId() == null) {
            return false;
        }
        if (boundary.exterior()) {
            return false;
        }
        RoomCluster cluster = layout.findCluster(boundary.clusterId());
        RoomCluster projectedCluster = cluster == null ? null : cluster.projectedToLevel(levelZ);
        return projectedCluster != null && projectedCluster.canCreateDoor(hit.boundarySegment2x());
    }

    private DungeonSelectionRef resolvedHitRef(
            features.world.dungeonmap.shell.interaction.DungeonHitSnapshot snapshot,
            DungeonLayout layout,
            int levelZ
    ) {
        if (snapshot == null) {
            return null;
        }
        List<DungeonSelectionRef> refs = snapshot.orderedRefs();
        if (refs.isEmpty()) {
            return null;
        }
        if (sessionState.selectedTool() == DungeonEditorTool.CONNECTIONS_DELETE) {
            return resolveDeleteRef(refs);
        }
        return resolveCreateRef(refs, layout, levelZ);
    }

    private DungeonSelectionRef resolveCreateRef(List<DungeonSelectionRef> refs, DungeonLayout layout, int levelZ) {
        if (pendingEndpoint == null) {
            DungeonSelectionRef editableDoor = firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                            && isEditableDoorBoundary(
                            roomBoundary,
                            layout == null ? null : layout.describeRoomBoundary(roomBoundary, levelZ),
                            layout,
                            levelZ));
            if (editableDoor != null) {
                return editableDoor;
            }
            DungeonSelectionRef exteriorBoundary = firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                            && isExteriorBoundary(layout, roomBoundary, levelZ));
            if (exteriorBoundary != null) {
                return exteriorBoundary;
            }
            DungeonSelectionRef corridorTile = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorTileRef);
            if (corridorTile != null) {
                return corridorTile;
            }
            return firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.ConnectionRef
                            || ref instanceof DungeonSelectionRef.RoomRef
                            || ref instanceof DungeonSelectionRef.CorridorRef);
        }
        if (pendingEndpoint instanceof PendingDoor) {
            DungeonSelectionRef corridorTile = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorTileRef);
            if (corridorTile != null) {
                return corridorTile;
            }
            DungeonSelectionRef exteriorBoundary = firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                            && isExteriorBoundary(layout, roomBoundary, levelZ));
            if (exteriorBoundary != null) {
                return exteriorBoundary;
            }
            return firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.ConnectionRef
                            || ref instanceof DungeonSelectionRef.RoomRef
                            || ref instanceof DungeonSelectionRef.CorridorRef);
        }
        DungeonSelectionRef exteriorBoundary = firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                        && isExteriorBoundary(layout, roomBoundary, levelZ));
        if (exteriorBoundary != null) {
            return exteriorBoundary;
        }
        DungeonSelectionRef corridorTile = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorTileRef);
        if (corridorTile != null) {
            return corridorTile;
        }
        return firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.ConnectionRef
                        || ref instanceof DungeonSelectionRef.RoomRef
                        || ref instanceof DungeonSelectionRef.CorridorRef);
    }

    private static DungeonSelectionRef resolveDeleteRef(List<DungeonSelectionRef> refs) {
        DungeonSelectionRef localConnection = firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.ConnectionRef connection
                        && connection.connectionKind() == ConnectionKind.LOCAL);
        if (localConnection != null) {
            return localConnection;
        }
        DungeonSelectionRef corridorDoor = firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.ConnectionRef connection
                        && connection.connectionKind() == ConnectionKind.CORRIDOR);
        if (corridorDoor != null) {
            return corridorDoor;
        }
        DungeonSelectionRef corridorNode = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorNodeRef);
        if (corridorNode != null) {
            return corridorNode;
        }
        return firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorSegmentRef);
    }

    private static boolean isExteriorBoundary(DungeonLayout layout, DungeonSelectionRef.RoomBoundaryRef ref, int levelZ) {
        DungeonLayout.RoomBoundaryDescription boundary = layout == null ? null : layout.describeRoomBoundary(ref, levelZ);
        return boundary != null && boundary.exterior();
    }

    private static DungeonSelectionRef firstMatching(
            List<DungeonSelectionRef> refs,
            java.util.function.Predicate<DungeonSelectionRef> predicate
    ) {
        if (refs == null || predicate == null) {
            return null;
        }
        for (DungeonSelectionRef ref : refs) {
            if (ref != null && predicate.test(ref)) {
                return ref;
            }
        }
        return null;
    }

    private void applySelection(DungeonSelectionRef resolvedRef) {
        if (resolvedRef != null) {
            state.selectRef(resolvedRef);
        }
    }

    private void clearPendingEndpoint() {
        pendingEndpoint = null;
        refreshStatePane();
    }

    private Corridor selectedCorridor() {
        return mapState.activeMap().corridor(state.selectedRef());
    }

    private Long selectedNodeId() {
        return state.selectedRef() instanceof DungeonSelectionRef.CorridorNodeRef corridorNodeRef
                ? corridorNodeRef.nodeId()
                : null;
    }

    private Long selectedSegmentId() {
        return state.selectedRef() instanceof DungeonSelectionRef.CorridorSegmentRef corridorSegmentRef
                ? corridorSegmentRef.segmentId()
                : null;
    }

    private String statusText() {
        if (activeTool == DungeonEditorTool.CONNECTIONS_DELETE) {
            return "Segment, Node oder Corridor-Tür anklicken.";
        }
        return switch (pendingEndpoint) {
            case PendingDoor ignored -> "Jetzt Außenwand oder Corridor-Tile anklicken.";
            case PendingTile ignored -> "Jetzt Außenwand anklicken.";
            case null -> "Außenwand oder Corridor-Tile anklicken.";
        };
    }

    private String selectionText(Corridor corridor) {
        if (activeTool == DungeonEditorTool.CONNECTIONS_DELETE) {
            Long selectedNodeId = selectedNodeId();
            if (selectedNodeId != null) {
                return "Löschen: Node " + selectedNodeId;
            }
            Long selectedSegmentId = selectedSegmentId();
            if (selectedSegmentId != null) {
                return "Löschen: Segment " + selectedSegmentId;
            }
            if (state.selectedRef() instanceof DungeonSelectionRef.ConnectionRef connectionRef
                    && connectionRef.connectionKind() == ConnectionKind.CORRIDOR) {
                return "Löschen: Corridor-Tür";
            }
        }
        Long selectedNodeId = selectedNodeId();
        if (selectedNodeId != null) {
            return "Gewählter Node: " + selectedNodeId;
        }
        Long selectedSegmentId = selectedSegmentId();
        if (selectedSegmentId != null) {
            return "Gewähltes Segment: " + selectedSegmentId;
        }
        if (pendingEndpoint instanceof PendingDoor pendingDoor) {
            return "Start: " + roomName(pendingDoor.endpoint().roomId());
        }
        if (pendingEndpoint instanceof PendingTile pendingTile) {
            return "Start-Tile: " + pendingTile.tileCell().x() + "," + pendingTile.tileCell().y();
        }
        return corridor == null ? "Kein Corridor gewählt" : "Gewählter Corridor: " + corridor.corridorId();
    }

    private String connectedRoomsText(Corridor corridor) {
        if (corridor == null) {
            return "";
        }
        String rooms = corridor.connectedRoomIds().stream()
                .map(this::roomName)
                .collect(Collectors.joining(", "));
        return rooms.isBlank() ? "" : "Verbunden: " + rooms;
    }

    private String roomName(Long roomId) {
        Room room = roomId == null ? null : mapState.activeMap().findRoom(roomId);
        return room == null ? "Raum " + roomId : room.name();
    }

    private void refreshStatePane() {
        if (activeTool != null) {
            refreshCallback.run();
        }
    }

    private static CorridorEndpoint corridorEndpoint(
            DungeonSelectionRef.RoomBoundaryRef hit,
            DungeonLayout.RoomBoundaryDescription boundary
    ) {
        return new CorridorEndpoint(hit.roomId(), boundary.roomCell(), boundary.outwardDirection());
    }

    private static String normalizedName(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static DungeonSelectionRef corridorOwnerRef(Long corridorId) {
        return corridorId == null ? null : new DungeonSelectionRef.CorridorRef(corridorId);
    }

    private static DungeonSelectionRef clusterOwnerRef(Long clusterId) {
        return clusterId == null ? null : new DungeonSelectionRef.ClusterRef(clusterId);
    }

    private static DungeonSelectionRef stairOwnerRef(Long stairId) {
        return stairId == null ? null : new DungeonSelectionRef.StairRef(stairId);
    }

    private sealed interface PendingEndpoint permits PendingDoor, PendingTile {
    }

    private record PendingDoor(CorridorEndpoint endpoint) implements PendingEndpoint {
    }

    private record PendingTile(Long corridorId, CellCoord tileCell) implements PendingEndpoint {
    }

    private record CorridorEndpoint(Long roomId, CellCoord roomCell, CardinalDirection outwardDirection) {
        private DungeonCorridorApplicationService.CorridorDoorEndpoint asRequestEndpoint() {
            return new DungeonCorridorApplicationService.CorridorDoorEndpoint(roomId, roomCell, outwardDirection);
        }
    }

    private record StairDraftResolution(
            DungeonStairApplicationService.StairDraft draft,
            DungeonStair previewStair,
            String validationMessage
    ) {
    }

    private enum ConnectionsMode {
        CONNECTIONS("Verbindungen"),
        STAIR("Treppen");

        private final String label;

        ConnectionsMode(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }
}
