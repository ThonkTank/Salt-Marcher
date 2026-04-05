package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.application.stair.DungeonStairApplicationService;
import features.world.dungeonmap.application.stair.StairNameGenerator;
import features.world.dungeonmap.application.stair.StairDraftResolver;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
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
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class ConnectionsTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonRoomApplicationService roomApplicationService;
    private final DungeonCorridorApplicationService corridorApplicationService;
    private final DungeonStairApplicationService stairApplicationService;
    private final EditorInteractionState state;

    private final Label connectionSummaryLabel = new Label();
    private final Label connectionDetailLabel = new Label();
    private final Label connectionMetaLabel = new Label();
    private final VBox connectionBox = new VBox(6, connectionSummaryLabel, connectionDetailLabel, connectionMetaLabel);

    private final Label stairSummaryLabel = new Label("Keine Treppe gewählt");
    private final Label stairAnchorLabel = new Label("Kein Treppenanker");
    private final Label stairNameInputLabel = fieldLabel("Name");
    private final Label stairShapeInputLabel = fieldLabel("Form");
    private final Label stairDirectionInputLabel = fieldLabel("Richtung");
    private final Label stairDimension1Label = fieldLabel("Maß");
    private final Label stairDimension2Label = fieldLabel("Maß");
    private final Label stairExitLevelInputLabel = fieldLabel("Exit-Level");
    private final Label stairExitChipsLabel = fieldLabel("Exits");
    private final TextField stairNameField = new TextField();
    private final ComboBox<StairShape> stairShapeBox = new ComboBox<>();
    private final ComboBox<CardinalDirection> stairDirectionBox = new ComboBox<>();
    private final TextField stairDimension1Field = new TextField();
    private final TextField stairDimension2Field = new TextField();
    private final TextField stairExitLevelField = new TextField();
    private final Button stairAddExitButton = new Button("Hinzufügen");
    private final FlowPane stairExitChips = new FlowPane();
    private final Button stairApplyButton = new Button("Übernehmen");
    private final Button stairCancelButton = new Button("Abbrechen");
    private final Label stairStatusLabel = new Label();
    private final VBox stairNameBlock = fieldBlock(stairNameInputLabel, stairNameField);
    private final VBox stairShapeBlock = fieldBlock(stairShapeInputLabel, stairShapeBox);
    private final VBox stairDirectionBlock = fieldBlock(stairDirectionInputLabel, stairDirectionBox);
    private final VBox stairDimension1Block = fieldBlock(stairDimension1Label, stairDimension1Field);
    private final VBox stairDimension2Block = fieldBlock(stairDimension2Label, stairDimension2Field);
    private final HBox stairExitLevelRow = new HBox(6, stairExitLevelField, stairAddExitButton);
    private final VBox stairExitLevelBlock = fieldBlock(stairExitLevelInputLabel, stairExitLevelRow);
    private final VBox stairExitChipsBlock = fieldBlock(stairExitChipsLabel, stairExitChips);
    private final HBox stairShapeRow = fieldRow(stairShapeBlock);
    private final HBox stairDirectionDimensionRow = fieldRow(stairDirectionBlock, stairDimension1Block);
    private final HBox stairDimension2Row = fieldRow(stairDimension2Block);
    private final VBox stairFieldsBox = new VBox(
            8,
            stairNameBlock,
            stairShapeRow,
            stairDirectionDimensionRow,
            stairDimension2Row,
            stairExitLevelBlock,
            stairExitChipsBlock);
    private final Region stairActionSpacer = new Region();
    private final HBox stairActionRow = new HBox(6, stairActionSpacer, stairApplyButton, stairCancelButton);
    private final VBox stairFormBox = new VBox(8, stairFieldsBox, stairActionRow);
    private final VBox connectionCard = EditorCards.card("Connections", connectionBox);
    private final VBox stairCard = EditorCards.card("Treppe", stairSummaryLabel, stairAnchorLabel, stairFormBox, stairStatusLabel);

    private PendingEndpoint pendingEndpoint;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
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
    private DungeonStair lastResolvedStair;

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
        Objects.requireNonNull(sessionState, "sessionState");
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
            clearStairDraftState(false);
            state.clearPreview();
        } else if (stairFlowActive()) {
            refreshStairPreview();
        }
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        pendingEndpoint = null;
        if (!(state.selectedRef() instanceof DungeonSelectionRef.StairRef)) {
            clearStairDraftState(false);
        }
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null) {
            return false;
        }
        if (activeTool == DungeonEditorTool.CONNECTIONS && event.isSecondaryButton()) {
            return cancelActiveCreateFlow();
        }
        if (!event.isPrimaryButton()) {
            return false;
        }
        DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
        DungeonLayout layout = ctx == null ? null : ctx.activeMap();
        if (activeTool == DungeonEditorTool.CONNECTIONS_DELETE) {
            return handleDeletePressed(ctx, layout, hit);
        }
        return handleCreatePressed(ctx, layout, hit);
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
    public List<EditorInteractionCapability> interactionCapabilities(EditorToolContext ctx, EditorToolPhase phase) {
        if (activeTool == null || ctx == null) {
            return List.of();
        }
        return activeTool == DungeonEditorTool.CONNECTIONS_DELETE
                ? deleteCapabilities()
                : createCapabilities(ctx);
    }

    @Override
    public Node statePaneContent() {
        if (activeTool == null) {
            return null;
        }
        if (activeTool == DungeonEditorTool.CONNECTIONS) {
            Node stairPane = sharedStairPaneContent();
            if (stairPane != null) {
                return stairPane;
            }
        }
        if (pendingEndpoint != null) {
            return null;
        }
        Connection selectedConnection = selectedConnection();
        if (selectedConnection != null) {
            renderConnectionPane(selectedConnection, null);
            return connectionCard;
        }
        Corridor selectedCorridor = selectedCorridor();
        if (selectedCorridor != null) {
            renderConnectionPane(null, selectedCorridor);
            return connectionCard;
        }
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private void initializeStatePane() {
        connectionSummaryLabel.setWrapText(true);
        connectionDetailLabel.setWrapText(true);
        connectionMetaLabel.setWrapText(true);
        stairSummaryLabel.setWrapText(true);
        stairAnchorLabel.setWrapText(true);
        stairStatusLabel.setWrapText(true);
        stairStatusLabel.getStyleClass().add("text-muted");
        stairNameField.setPromptText("Treppenname");
        stairExitLevelField.setPromptText("z");
        stairExitChips.setHgap(6);
        stairExitChips.setVgap(6);
        stairExitChips.setMaxWidth(Double.MAX_VALUE);
        stairFormBox.setFillWidth(true);
        stairFieldsBox.setFillWidth(true);
        stairCard.setFillWidth(true);
        stairActionRow.getStyleClass().add("editor-action-row");
        HBox.setHgrow(stairActionSpacer, Priority.ALWAYS);
        HBox.setHgrow(stairExitLevelField, Priority.ALWAYS);
        stairExitLevelRow.setMaxWidth(Double.MAX_VALUE);
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
        stairShapeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged();
            }
        });
        stairDirectionBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged();
            }
        });
        stairDimension1Field.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged();
            }
        });
        stairDimension2Field.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged();
            }
        });
        stairNameField.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged();
            }
        });
        stairExitLevelField.setOnAction(event -> addExitLevel());
        stairAddExitButton.setOnAction(event -> addExitLevel());
        stairApplyButton.setOnAction(event -> commitStairDraft());
        stairCancelButton.setOnAction(event -> cancelStairDraft());
    }

    private void renderConnectionPane(Connection connection, Corridor corridor) {
        if (connection != null) {
            connectionSummaryLabel.setText(connectionSummaryText(connection));
            connectionDetailLabel.setText(connectionEndpointsText(connection));
            connectionMetaLabel.setText(connectionSegmentText());
            return;
        }
        if (corridor == null) {
            connectionSummaryLabel.setText("");
            connectionDetailLabel.setText("");
            connectionMetaLabel.setText("");
            return;
        }
        connectionSummaryLabel.setText(corridorLabel(corridor.corridorId()));
        connectionDetailLabel.setText("Nodes: " + corridor.nodes().size() + " · Segmente: " + corridor.segments().size());
        connectionMetaLabel.setText(connectedRoomsText(corridor));
    }

    private void renderStairPane() {
        StairDraftResolution resolution = resolveCurrentStairDraft(true);
        boolean createMode = activeTool == DungeonEditorTool.CONNECTIONS;
        stairSummaryLabel.setText(stairSummaryText());
        stairAnchorLabel.setText(stairAnchorText());
        stairFormBox.setManaged(createMode);
        stairFormBox.setVisible(createMode);
        StairShape shape = currentStairShape();
        updateStairFieldLayout(shape);
        renderExitChips();
        stairExitLevelField.setDisable(stairDraftLoading || !createMode || stairAnchorCell == null);
        stairAddExitButton.setDisable(stairDraftLoading || !createMode || stairAnchorCell == null);
        stairApplyButton.setDisable(!createMode || stairDraftLoading || stairAnchorCell == null);
        stairCancelButton.setDisable(stairDraftLoading || (stairAnchorCell == null && stairDraftId == null));
        stairStatusLabel.setText(stairStatusText(resolution));
    }

    private void updateStairFieldLayout(StairShape shape) {
        StairShape resolvedShape = shape == null ? StairShape.LADDER : shape;
        boolean showDirection = resolvedShape.needsDirection();
        boolean showDimension1 = resolvedShape.needsSideLength() || resolvedShape.needsDimensions() || resolvedShape.needsRadius();
        boolean showDimension2 = resolvedShape.needsDimensions();
        stairDimension1Label.setText(switch (resolvedShape) {
            case SQUARE -> "Seitenlänge";
            case RECTANGULAR -> "Breite";
            case CIRCULAR -> "Radius";
            case LADDER, STRAIGHT -> "";
        });
        stairDimension2Label.setText(resolvedShape == StairShape.RECTANGULAR ? "Tiefe" : "");
        setNodeVisibility(stairDirectionBlock, showDirection);
        setNodeVisibility(stairDimension1Block, showDimension1);
        setNodeVisibility(stairDimension2Block, showDimension2);
        setNodeVisibility(stairDirectionDimensionRow, showDirection || showDimension1);
        setNodeVisibility(stairDimension2Row, showDimension2);
        stairDimension1Field.setPromptText(showDimension1 ? stairDimension1Label.getText() : "");
        stairDimension2Field.setPromptText(showDimension2 ? stairDimension2Label.getText() : "");
    }

    private void renderExitChips() {
        stairExitChips.getChildren().clear();
        for (Integer level : sortedStopLevels()) {
            if (level == null) {
                continue;
            }
            boolean anchorLevel = Objects.equals(stairAnchorLevelZ, level);
            HBox chip = new HBox(2);
            chip.getStyleClass().addAll("chip", anchorLevel ? "chip-type" : "chip-cr");
            Label label = new Label(anchorLevel ? "z=" + level + " · Anker" : "z=" + level);
            chip.getChildren().add(label);
            if (activeTool == DungeonEditorTool.CONNECTIONS && !stairDraftLoading) {
                chip.setOnMouseClicked(event -> selectStairAnchorLevel(level));
            } else {
                chip.setOnMouseClicked(null);
            }
            if (!anchorLevel && activeTool == DungeonEditorTool.CONNECTIONS) {
                Button remove = new Button("\u00d7");
                remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
                remove.setAccessibleText("Entfernen: Exit z=" + level);
                remove.setDisable(stairDraftLoading);
                remove.setOnMouseClicked(event -> event.consume());
                remove.setOnAction(event -> removeExitLevel(level));
                chip.getChildren().add(remove);
            }
            stairExitChips.getChildren().add(chip);
        }
    }

    private void onStairFieldChanged() {
        clearStairStatusOverride();
        if (stairAnchorCell == null || stairDraftLoading) {
            refreshStatePane();
            return;
        }
        stairDraftDirty = true;
        refreshStairPreview();
        refreshStatePane();
    }

    private void addExitLevel() {
        clearStairStatusOverride();
        if (stairAnchorCell == null || stairDraftLoading) {
            refreshStatePane();
            return;
        }
        Integer level = parseInteger(stairExitLevelField.getText());
        if (level == null) {
            stairStatusOverride = "Exit-Level ist ungültig";
            refreshStatePane();
            return;
        }
        if (!stairStopLevels.add(level)) {
            stairStatusOverride = "Exit z=" + level + " ist bereits vorhanden";
            refreshStatePane();
            return;
        }
        stairExitLevelField.clear();
        stairDraftDirty = true;
        refreshStairPreview();
        refreshStatePane();
    }

    private void removeExitLevel(int level) {
        clearStairStatusOverride();
        if (Objects.equals(stairAnchorLevelZ, level)) {
            refreshStatePane();
            return;
        }
        if (!stairStopLevels.remove(level)) {
            refreshStatePane();
            return;
        }
        stairDraftDirty = true;
        refreshStairPreview();
        refreshStatePane();
    }

    private boolean selectStairAnchorLevel(Integer level) {
        if (level == null || stairDraftLoading || stairAnchorCell == null || stairAnchorLevelZ == null) {
            return false;
        }
        DungeonStair stair = resolvedStairForAnchorSelection();
        CubePoint anchorPoint = exitPointAtLevel(stair, level);
        if (anchorPoint == null) {
            return false;
        }
        if (Objects.equals(stairAnchorLevelZ, level) && Objects.equals(stairAnchorCell, anchorPoint.projectedCell())) {
            return false;
        }
        clearStairStatusOverride();
        stairAnchorCell = anchorPoint.projectedCell();
        stairAnchorLevelZ = level;
        stairStopLevels.add(level);
        stairDraftDirty = true;
        refreshStairPreview();
        refreshStatePane();
        return true;
    }

    private DungeonStair resolvedStairForAnchorSelection() {
        StairDraftResolution resolution = resolveCurrentStairDraft(true);
        if (resolution.previewStair() != null) {
            return resolution.previewStair();
        }
        return lastResolvedStair;
    }

    private Integer preferredAnchorLevel(Long stairId, EditorToolContext ctx) {
        DungeonStair stair = displayedStair(stairId);
        CubePoint clickedPoint = clickedPoint(ctx);
        if (stair == null || clickedPoint == null) {
            return null;
        }
        for (var exit : stair.exits()) {
            if (Objects.equals(exit.position(), clickedPoint)) {
                return exit.position().z();
            }
        }
        return stair.exits().stream()
                .min(Comparator
                        .comparingInt((features.world.dungeonmap.model.structures.stair.DungeonStairExit exit) ->
                                stairExitDistance(clickedPoint, exit.position()))
                        .thenComparingInt(exit -> stairExitTieRank(stairId, exit.position().z()))
                        .thenComparingInt(exit -> exit.position().z()))
                .map(exit -> exit.position().z())
                .orElse(null);
    }

    private DungeonStair displayedStair(Long stairId) {
        if (stairId == null) {
            return null;
        }
        if (Objects.equals(stairDraftId, stairId) && stairFlowActive()) {
            DungeonStair preview = resolvedStairForAnchorSelection();
            if (preview != null) {
                return preview;
            }
        }
        return mapState.activeMap().findStair(stairId);
    }

    private static CubePoint clickedPoint(EditorToolContext ctx) {
        if (ctx == null || ctx.probe() == null) {
            return null;
        }
        return CubePoint.at(ctx.probe().gridCell(), ctx.probe().levelZ());
    }

    private static CubePoint exitPointAtLevel(DungeonStair stair, int level) {
        if (stair == null) {
            return null;
        }
        return stair.exits().stream()
                .map(exit -> exit.position())
                .filter(position -> position.z() == level)
                .findFirst()
                .orElse(null);
    }

    private int stairExitTieRank(Long stairId, int level) {
        return Objects.equals(stairDraftId, stairId) && Objects.equals(stairAnchorLevelZ, level) ? 0 : 1;
    }

    private static int stairExitDistance(CubePoint clickedPoint, CubePoint exitPoint) {
        if (clickedPoint == null || exitPoint == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(clickedPoint.x() - exitPoint.x())
                + Math.abs(clickedPoint.y() - exitPoint.y())
                + Math.abs(clickedPoint.z() - exitPoint.z());
    }

    private List<Integer> sortedStopLevels() {
        return stairStopLevels.stream()
                .filter(Objects::nonNull)
                .sorted()
                .toList();
    }

    private void refreshFromMapState() {
        boolean mapChanged = !Objects.equals(previousMapId, mapState.activeMapId());
        previousMapId = mapState.activeMapId();
        if (mapChanged) {
            pendingEndpoint = null;
            clearStairDraftState(false);
        }
        DungeonStair persistedStair = stairDraftId == null ? null : mapState.activeMap().findStair(stairDraftId);
        if (stairDraftId != null && persistedStair == null) {
            clearStairDraftState(false);
        } else if (!stairDraftDirty) {
            lastResolvedStair = persistedStair;
        }
        if ((activeTool == DungeonEditorTool.CONNECTIONS || state.selectedRef() instanceof DungeonSelectionRef.StairRef)
                && stairFlowActive()) {
            refreshStairPreview();
        }
        refreshStatePane();
    }

    private boolean handleStairCreatePressed(EditorToolContext ctx) {
        if (focusSelectedStair(ctx)) {
            return true;
        }
        DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
        if (!(hit instanceof DungeonSelectionRef.FloorCellRef floorCellRef)) {
            return false;
        }
        clearPendingEndpoint();
        state.clearSelection();
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
                suggestedStairName(),
                StairShape.LADDER,
                CardinalDirection.defaultDirection(),
                2,
                2,
                stairStopLevels);
        refreshStairPreview();
        refreshStatePane();
    }

    private void loadStairEditor(long stairId, Integer preferredAnchorLevel) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || stairId <= 0) {
            return;
        }
        pendingEndpoint = null;
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
                            || !Objects.equals(mapState.activeMapId(), mapId)
                            || !wantsStairEditor(stairId)) {
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
                            spec.dimension1(),
                            spec.dimension2(),
                            spec.stopLevels());
                    lastResolvedStair = mapState.activeMap().findStair(spec.stairId());
                    if (preferredAnchorLevel == null || !selectStairAnchorLevel(preferredAnchorLevel)) {
                        state.clearPreview();
                        refreshStatePane();
                    }
                },
                throwable -> {
                    if (requestId != stairLoadRequestSequence) {
                        return;
                    }
                    stairDraftLoading = false;
                    stairStatusOverride = "Treppendaten konnten nicht geladen werden";
                    lastResolvedStair = null;
                    UiErrorReporter.reportBackgroundFailure("ConnectionsTool.loadStairEditor()", throwable);
                    refreshStatePane();
                });
    }

    private void setStairFields(
            String name,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            Set<Integer> stopLevels
    ) {
        syncingStairFields = true;
        stairNameField.setText(name == null ? "" : name);
        stairShapeBox.setValue(shape == null ? StairShape.LADDER : shape);
        stairDirectionBox.setValue(direction == null ? CardinalDirection.defaultDirection() : direction);
        stairDimension1Field.setText(Integer.toString(dimension1));
        stairDimension2Field.setText(Integer.toString(dimension2));
        stairExitLevelField.clear();
        stairStopLevels.clear();
        for (Integer stopLevel : stopLevels == null ? Set.<Integer>of() : stopLevels) {
            if (stopLevel != null) {
                stairStopLevels.add(stopLevel);
            }
        }
        if (stairAnchorLevelZ != null) {
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
        lastResolvedStair = null;
        clearStairStatusOverride();
        syncingStairFields = true;
        stairNameField.setText("");
        stairShapeBox.setValue(StairShape.LADDER);
        stairDirectionBox.setValue(CardinalDirection.defaultDirection());
        stairExitLevelField.setText("");
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
        if (activeTool != DungeonEditorTool.CONNECTIONS
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
        lastResolvedStair = previewStair;
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
        StairShape shape = currentStairShape();
        CardinalDirection direction = currentDirection();
        int dimension1 = resolvedDimension(stairDimension1Field.getText(), shape.needsSideLength() || shape.needsDimensions() || shape.needsRadius());
        int dimension2 = resolvedDimension(stairDimension2Field.getText(), shape.needsDimensions());
        // The UI authors only exit chips; the actual stair span is always the lowest/highest authored exit.
        LinkedHashSet<Integer> stopLevels = stairStopLevels.stream()
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toCollection(LinkedHashSet::new));
        stopLevels.add(stairAnchorLevelZ);
        int minLevel = stopLevels.stream().min(Integer::compareTo).orElse(stairAnchorLevelZ);
        int maxLevel = stopLevels.stream().max(Integer::compareTo).orElse(stairAnchorLevelZ);
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
        Long mapId = mapState.activeMapId();
        DungeonLayout layout = mapState.activeMap();
        if (mapId == null || layout == null) {
            return new StairDraftResolution(null, null, "Kein aktiver Dungeon geladen");
        }
        try {
            DungeonStair previewStair = allowSingleStop
                    ? StairDraftResolver.resolvePreview(layout, stairDraftId, mapId, draft)
                    : StairDraftResolver.resolveCommitted(layout, stairDraftId, mapId, draft);
            lastResolvedStair = previewStair;
            String status = stopLevels.size() < 2
                    ? "Mindestens einen weiteren Exit hinzufügen"
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
        if (stairDraftId != null) {
            return "Bearbeiten: " + stairLabel(stairDraftId);
        }
        return "Neue Treppe";
    }

    private String stairAnchorText() {
        if (stairAnchorCell == null || stairAnchorLevelZ == null) {
            return "Kein Treppenanker";
        }
        return "Anker: z=" + stairAnchorLevelZ + " · " + stairAnchorCell.x() + "," + stairAnchorCell.y();
    }

    private String stairStatusText(StairDraftResolution resolution) {
        if (stairStatusOverride != null && !stairStatusOverride.isBlank()) {
            return stairStatusOverride;
        }
        if (stairDraftLoading) {
            return "Treppendaten werden geladen";
        }
        return resolution.validationMessage();
    }

    private boolean handleCreatePressed(EditorToolContext ctx, DungeonLayout layout, DungeonSelectionRef hit) {
        if (hit instanceof DungeonSelectionRef.StairRef || hit instanceof DungeonSelectionRef.FloorCellRef) {
            return handleStairCreatePressed(ctx);
        }
        return handleConnectionsPressed(ctx, layout, hit);
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
                clearPendingEndpoint();
                applyDoorEdit(
                        boundary.clusterId(),
                        roomBoundaryHit.boundarySegment2x(),
                        false,
                        localConnectionRef(boundary.clusterId(), roomBoundaryHit.boundarySegment2x()));
                return true;
            }
            if (!boundary.exterior()) {
                return false;
            }
            CorridorEndpoint endpoint = corridorEndpoint(roomBoundaryHit, boundary);
            if (pendingEndpoint instanceof PendingCorridorBoundary pendingCorridorBoundary) {
                attachDoorToBoundary(endpoint, pendingCorridorBoundary);
                return true;
            }
            if (pendingEndpoint instanceof PendingRoomBoundary pendingRoomBoundary) {
                if (Objects.equals(pendingRoomBoundary.boundarySegment2x(), roomBoundaryHit.boundarySegment2x())) {
                    return true;
                }
                createDoorToDoor(pendingRoomBoundary.endpoint(), endpoint);
                return true;
            }
            startPendingEndpoint(new PendingRoomBoundary(endpoint, roomBoundaryHit.boundarySegment2x()));
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorBoundaryRef corridorBoundaryHit) {
            if (layout.describeCorridorBoundary(corridorBoundaryHit, levelZ) == null) {
                return false;
            }
            if (pendingEndpoint instanceof PendingRoomBoundary pendingRoomBoundary) {
                attachDoorToBoundary(
                        pendingRoomBoundary.endpoint(),
                        new PendingCorridorBoundary(corridorBoundaryHit.corridorId(), corridorBoundaryHit.boundarySegment2x()));
                return true;
            }
            if (pendingEndpoint != null) {
                return false;
            }
            startPendingEndpoint(new PendingCorridorBoundary(
                    corridorBoundaryHit.corridorId(),
                    corridorBoundaryHit.boundarySegment2x()));
            return true;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef
                || hit instanceof DungeonSelectionRef.CorridorRef) {
            clearPendingEndpoint();
            applySelection(ctx == null ? null : ctx.resolvedRef());
            return true;
        }
        return false;
    }

    private boolean handleDeletePressed(EditorToolContext ctx, DungeonLayout layout, DungeonSelectionRef hit) {
        if (hit instanceof DungeonSelectionRef.StairRef) {
            return handleStairDeletePressed(ctx);
        }
        if (layout == null || hit == null) {
            return false;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef connectionHit
                && connectionHit.connectionKind() == ConnectionKind.LOCAL) {
            applyDoorEdit(
                    connectionHit.ownerId(),
                    connectionHit.boundarySegment2x(),
                    true,
                    null);
            return true;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef connectionHit
                && connectionHit.connectionKind() == ConnectionKind.CORRIDOR
                && connectionHit.ownerId() != null) {
            deleteCorridorDoor(connectionHit.ownerId(), connectionHit.boundarySegment2x());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorNodeRef corridorNodeHit
                && corridorNodeHit.corridorId() != null
                && corridorNodeHit.nodeId() != null) {
            deleteCorridorNode(corridorNodeHit.corridorId(), corridorNodeHit.nodeId());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorSegmentRef corridorSegmentHit
                && corridorSegmentHit.corridorId() != null
                && corridorSegmentHit.segmentId() != null) {
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

    private void attachDoorToBoundary(CorridorEndpoint endpoint, PendingCorridorBoundary pendingCorridorBoundary) {
        if (endpoint == null
                || pendingCorridorBoundary == null
                || pendingCorridorBoundary.corridorId() == null
                || pendingCorridorBoundary.boundarySegment2x() == null) {
            return;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.attachDoorToCorridorBoundary(
                            new DungeonCorridorApplicationService.AttachDoorToCorridorBoundaryRequest(
                            mapId,
                            pendingCorridorBoundary.corridorId(),
                            endpoint.asRequestEndpoint(),
                            pendingCorridorBoundary.boundarySegment2x()));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    clearPendingEndpoint();
                    state.selectRef(corridorOwnerRef(pendingCorridorBoundary.corridorId()));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.attachDoorToBoundary()", throwable));
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
                ignored -> {
                    if (followUpRef != null) {
                        state.selectRef(followUpRef);
                    } else {
                        state.clearSelection();
                    }
                },
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

    private List<EditorInteractionCapability> createCapabilities(EditorToolContext ctx) {
        DungeonLayout layout = ctx.activeMap();
        int levelZ = ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ();
        if (stairFlowActive()) {
            return stairDraftId == null
                    ? List.of()
                    : List.of(EditorCapabilities.owner(ref ->
                            ref instanceof DungeonSelectionRef.StairRef stairRef
                                    && Objects.equals(stairRef.stairId(), stairDraftId)));
        }
        if (pendingEndpoint == null) {
            return List.of(
                    EditorCapabilities.part(ref ->
                            ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                                    && isEditableDoorBoundary(
                                    roomBoundary,
                                    layout == null ? null : layout.describeRoomBoundary(roomBoundary, levelZ),
                                    layout,
                                    levelZ)),
                    EditorCapabilities.part(ref ->
                            ref instanceof DungeonSelectionRef.CorridorBoundaryRef corridorBoundaryRef
                                    && ConnectionSurfaceSupport.isAvailableCorridorBoundary(layout, corridorBoundaryRef, levelZ)),
                    EditorCapabilities.part(ref ->
                            ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                                    && ConnectionSurfaceSupport.isExteriorRoomBoundary(layout, roomBoundary, levelZ)),
                    EditorCapabilities.owner(ref -> ref instanceof DungeonSelectionRef.StairRef),
                    EditorCapabilities.part(ref -> ref instanceof DungeonSelectionRef.ConnectionRef),
                    EditorCapabilities.owner(ref -> ref instanceof DungeonSelectionRef.CorridorRef),
                    EditorCapabilities.partFallback(this::roomFloorRef));
        }
        if (pendingEndpoint instanceof PendingRoomBoundary) {
            return List.of(
                    EditorCapabilities.part(ref ->
                            ref instanceof DungeonSelectionRef.CorridorBoundaryRef corridorBoundaryRef
                                    && ConnectionSurfaceSupport.isAvailableCorridorBoundary(layout, corridorBoundaryRef, levelZ)),
                    EditorCapabilities.part(ref ->
                            ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                                    && ConnectionSurfaceSupport.isExteriorRoomBoundary(layout, roomBoundary, levelZ)));
        }
        return List.of(EditorCapabilities.part(ref ->
                ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                        && ConnectionSurfaceSupport.isExteriorRoomBoundary(layout, roomBoundary, levelZ)));
    }

    private List<EditorInteractionCapability> deleteCapabilities() {
        return List.of(
                EditorCapabilities.owner(ref -> ref instanceof DungeonSelectionRef.StairRef),
                EditorCapabilities.part(ref ->
                        ref instanceof DungeonSelectionRef.ConnectionRef connection
                                && connection.connectionKind() == ConnectionKind.LOCAL),
                EditorCapabilities.part(ref ->
                        ref instanceof DungeonSelectionRef.ConnectionRef connection
                                && connection.connectionKind() == ConnectionKind.CORRIDOR),
                EditorCapabilities.part(ref -> ref instanceof DungeonSelectionRef.CorridorNodeRef),
                EditorCapabilities.part(ref -> ref instanceof DungeonSelectionRef.CorridorSegmentRef));
    }

    private void applySelection(DungeonSelectionRef resolvedRef) {
        if (resolvedRef != null) {
            state.selectRef(resolvedRef);
        }
    }

    private DungeonSelectionRef roomFloorRef(EditorToolContext ctx) {
        if (ctx == null || pendingEndpoint != null || stairFlowActive() || ctx.probe() == null) {
            return null;
        }
        DungeonLayout layout = ctx.activeMap();
        int levelZ = ctx.probe().levelZ();
        CellCoord gridCell = ctx.probe().gridCell();
        if (layout == null || layout.roomWithFloorAtCell(gridCell, levelZ) == null) {
            return null;
        }
        return new DungeonSelectionRef.FloorCellRef(CubePoint.at(gridCell, levelZ));
    }

    private boolean cancelActiveCreateFlow() {
        if (pendingEndpoint != null) {
            pendingEndpoint = null;
            state.clearSelection();
            state.clearPreview();
            refreshStatePane();
            return true;
        }
        if (stairFlowActive()) {
            cancelStairDraft();
            return true;
        }
        return false;
    }

    private void startPendingEndpoint(PendingEndpoint endpoint) {
        pendingEndpoint = endpoint;
        state.clearSelection();
        state.clearPreview();
        refreshStatePane();
    }

    private void clearPendingEndpoint() {
        pendingEndpoint = null;
        refreshStatePane();
    }

    private Connection selectedConnection() {
        DungeonSelectionRef.ConnectionRef connectionRef = selectedConnectionRef();
        return connectionRef == null
                ? null
                : mapState.activeMap().connectionAt(mapState.activeProjectionLevel(), connectionRef.boundarySegment2x());
    }

    private DungeonSelectionRef.ConnectionRef selectedConnectionRef() {
        return state.selectedRef() instanceof DungeonSelectionRef.ConnectionRef connectionRef ? connectionRef : null;
    }

    private Corridor selectedCorridor() {
        return mapState.activeMap().corridor(state.selectedRef());
    }

    private boolean stairFlowActive() {
        return stairDraftLoading || stairDraftId != null || stairAnchorCell != null;
    }

    private void ensureSelectedStairLoaded() {
        if (pendingEndpoint != null || stairFlowActive()) {
            return;
        }
        if (state.selectedRef() instanceof DungeonSelectionRef.StairRef stairRef && stairRef.stairId() != null) {
            loadStairEditor(stairRef.stairId(), null);
        }
    }

    private String connectionSummaryText(Connection connection) {
        if (connection == null) {
            return "";
        }
        return switch (connection.kind()) {
            case LOCAL -> "Tür";
            case CORRIDOR -> "Corridor-Tür";
            case STAIR -> "Treppen-Verbindung";
            case TRANSITION -> "Übergang";
        };
    }

    private String connectionEndpointsText(Connection connection) {
        if (connection == null) {
            return "";
        }
        return connection.endpoints().stream()
                .map(this::endpointLabel)
                .filter(label -> label != null && !label.isBlank())
                .collect(Collectors.joining(", "));
    }

    private String connectionSegmentText() {
        DungeonSelectionRef.ConnectionRef connectionRef = selectedConnectionRef();
        if (connectionRef == null || connectionRef.boundarySegment2x() == null) {
            return "";
        }
        GridSegment2x segment2x = connectionRef.boundarySegment2x();
        return "Segment: "
                + segment2x.start().x2() + "," + segment2x.start().y2()
                + " → "
                + segment2x.end().x2() + "," + segment2x.end().y2();
    }

    private String endpointLabel(ConnectionEndpoint endpoint) {
        if (endpoint == null) {
            return "";
        }
        return switch (endpoint.type()) {
            case ROOM -> roomName(endpoint.id());
            case CORRIDOR -> corridorLabel(endpoint.id());
            case STAIR -> stairLabel(endpoint.id());
            case TRANSITION -> transitionLabel(endpoint.id());
        };
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
        return room == null || room.name() == null || room.name().isBlank()
                ? "Raum " + roomId
                : room.name();
    }

    private String corridorLabel(Long corridorId) {
        return corridorId == null ? "Corridor" : "Corridor " + corridorId;
    }

    private String stairLabel(Long stairId) {
        DungeonStair stair = stairId == null ? null : mapState.activeMap().findStair(stairId);
        return stair == null ? "Treppe " + stairId : stair.label();
    }

    private String transitionLabel(Long transitionId) {
        var transition = transitionId == null ? null : mapState.activeMap().findTransition(transitionId);
        return transition == null ? "Übergang " + transitionId : transition.label();
    }

    private void refreshStatePane() {
        if (activeTool != null || state.selectedRef() instanceof DungeonSelectionRef.StairRef) {
            ensureSelectedStairLoaded();
            refreshCallback.run();
        }
    }

    Node sharedStairPaneContent() {
        if (!sharedStairPaneVisible()) {
            return null;
        }
        ensureSelectedStairLoaded();
        renderStairPane();
        return stairCard;
    }

    boolean focusSelectedStair(EditorToolContext ctx) {
        DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
        if (!(hit instanceof DungeonSelectionRef.StairRef stairRef) || stairRef.stairId() == null) {
            return false;
        }
        clearPendingEndpoint();
        state.selectRef(stairOwnerRef(stairRef.stairId()));
        Integer preferredAnchorLevel = preferredAnchorLevel(stairRef.stairId(), ctx);
        if (stairFlowActive() && Objects.equals(stairDraftId, stairRef.stairId())) {
            selectStairAnchorLevel(preferredAnchorLevel);
        } else {
            loadStairEditor(stairRef.stairId(), preferredAnchorLevel);
        }
        return true;
    }

    StairDragSource stairDragSource() {
        if (!(state.selectedRef() instanceof DungeonSelectionRef.StairRef stairRef) || stairRef.stairId() == null) {
            return null;
        }
        ensureSelectedStairLoaded();
        if (!Objects.equals(stairDraftId, stairRef.stairId()) || stairDraftLoading) {
            return null;
        }
        StairDraftResolution resolution = resolveCurrentStairDraft(false);
        if (resolution.draft() == null || stairDraftId == null) {
            return null;
        }
        return new StairDragSource(stairDraftId, resolution.draft());
    }

    void adoptMovedStairDraft(long stairId, DungeonStairApplicationService.StairDraft draft) {
        if (stairId <= 0 || draft == null) {
            return;
        }
        stairDraftLoading = false;
        stairDraftDirty = false;
        stairDraftId = stairId;
        stairAnchorCell = draft.anchorCell();
        stairAnchorLevelZ = draft.anchorLevelZ();
        clearStairStatusOverride();
        setStairFields(
                draft.name(),
                draft.shape(),
                draft.direction(),
                draft.dimension1(),
                draft.dimension2(),
                draft.stopLevels());
        lastResolvedStair = null;
        state.clearPreview();
        refreshStatePane();
    }

    private boolean sharedStairPaneVisible() {
        return state.selectedRef() instanceof DungeonSelectionRef.StairRef
                || activeTool == DungeonEditorTool.CONNECTIONS && stairFlowActive();
    }

    private boolean wantsStairEditor(long stairId) {
        return activeTool == DungeonEditorTool.CONNECTIONS
                || state.selectedRef() instanceof DungeonSelectionRef.StairRef stairRef
                && Objects.equals(stairRef.stairId(), stairId);
    }

    private static CorridorEndpoint corridorEndpoint(
            DungeonSelectionRef.RoomBoundaryRef hit,
            DungeonLayout.RoomBoundaryDescription boundary
    ) {
        return new CorridorEndpoint(hit.roomId(), boundary.roomCell(), boundary.outwardDirection());
    }

    private static VBox fieldBlock(Label label, Node field) {
        VBox block = new VBox(3, label, field);
        block.setFillWidth(true);
        block.setMaxWidth(Double.MAX_VALUE);
        block.setMinWidth(0);
        HBox.setHgrow(block, Priority.ALWAYS);
        configureGrowingRegion(field);
        return block;
    }

    private static HBox fieldRow(Node... blocks) {
        HBox row = new HBox(8);
        row.setFillHeight(true);
        row.setMaxWidth(Double.MAX_VALUE);
        row.setMinWidth(0);
        for (Node block : blocks) {
            if (block == null) {
                continue;
            }
            if (block instanceof Region region) {
                region.setMaxWidth(Double.MAX_VALUE);
                region.setMinWidth(0);
            }
            HBox.setHgrow(block, Priority.ALWAYS);
            row.getChildren().add(block);
        }
        return row;
    }

    record StairDragSource(long stairId, DungeonStairApplicationService.StairDraft draft) {
    }

    private static void setNodeVisibility(Node node, boolean visible) {
        if (node == null) {
            return;
        }
        node.setManaged(visible);
        node.setVisible(visible);
    }

    private static void configureGrowingRegion(Node node) {
        if (!(node instanceof Region region)) {
            return;
        }
        region.setMaxWidth(Double.MAX_VALUE);
        region.setMinWidth(0);
    }

    private static Label fieldLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        label.setMaxWidth(Double.MAX_VALUE);
        label.setMinWidth(0);
        return label;
    }

    private static String normalizedName(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String suggestedStairName() {
        DungeonLayout layout = mapState.activeMap();
        return layout == null ? null : StairNameGenerator.nextName(layout);
    }

    private static DungeonSelectionRef corridorOwnerRef(Long corridorId) {
        return corridorId == null ? null : new DungeonSelectionRef.CorridorRef(corridorId);
    }

    private static DungeonSelectionRef localConnectionRef(Long clusterId, GridSegment2x boundarySegment2x) {
        return clusterId == null || boundarySegment2x == null
                ? null
                : new DungeonSelectionRef.ConnectionRef(ConnectionKind.LOCAL, clusterId, boundarySegment2x);
    }

    private static DungeonSelectionRef stairOwnerRef(Long stairId) {
        return stairId == null ? null : new DungeonSelectionRef.StairRef(stairId);
    }

    private sealed interface PendingEndpoint permits PendingRoomBoundary, PendingCorridorBoundary {
    }

    private record PendingRoomBoundary(
            CorridorEndpoint endpoint,
            GridSegment2x boundarySegment2x
    ) implements PendingEndpoint {
    }

    private record PendingCorridorBoundary(
            Long corridorId,
            GridSegment2x boundarySegment2x
    ) implements PendingEndpoint {
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
}
