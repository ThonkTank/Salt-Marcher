package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.stair.DungeonStairApplicationService;
import features.world.dungeonmap.application.stair.StairDraftResolver;
import features.world.dungeonmap.application.stair.StairNameGenerator;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPathPatternKind;
import features.world.dungeonmap.geometry.GridPathPatternSpec;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonEditorTool;
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

/**
 * Editor tool for stair draft, edit, and delete interactions.
 *
 * <p>The tool owns stair form state and preview publication, while stair validation and path resolution stay in the
 * shared stair workflow seams so preview and commit cannot drift apart.</p>
 */
public final class StairTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonStairApplicationService stairApplicationService;
    private final EditorInteractionState state;

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
    private final ComboBox<GridPathPatternKind> stairShapeBox = new ComboBox<>();
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
    private final VBox stairCard = EditorCards.card("Treppe", stairSummaryLabel, stairAnchorLabel, stairFormBox, stairStatusLabel);

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
    private boolean syncingStairFields;
    private Long previousMapId;

    private Long stairDraftId;
    private GridPoint stairAnchorCell;
    private Integer stairAnchorLevelZ;
    private final LinkedHashSet<Integer> stairStopLevels = new LinkedHashSet<>();
    private boolean stairDraftDirty;
    private boolean stairDraftLoading;
    private long stairLoadRequestSequence;
    private String stairStatusOverride;
    private DungeonStair lastResolvedStair;

    public StairTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonStairApplicationService stairApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.stairApplicationService = Objects.requireNonNull(stairApplicationService, "stairApplicationService");
        this.state = Objects.requireNonNull(state, "state");
        initializeStatePane();
        clearStairDraftState(false);
        this.state.addListener(this::refreshStatePane);
        this.mapState.addListener(this::refreshFromMapState);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.STAIR);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        if (stairFlowActive()) {
            refreshStairPreview();
        }
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        if (!(state.selectedRef() instanceof DungeonSelectionRef.StairRef)) {
            clearStairDraftState(false);
        }
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (activeTool != DungeonEditorTool.STAIR || event == null) {
            return false;
        }
        if (event.isSecondaryButton()) {
            if (ctx != null && ctx.hitRef() instanceof DungeonSelectionRef.StairRef) {
                return handleStairDeletePressed(ctx);
            }
            if (stairFlowActive()) {
                cancelStairDraft();
                return true;
            }
            return false;
        }
        if (!event.isPrimaryButton()) {
            return false;
        }
        return handleStairCreatePressed(ctx);
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
        if (activeTool != DungeonEditorTool.STAIR || ctx == null) {
            return List.of();
        }
        if (stairFlowActive()) {
            return stairDraftId == null
                    ? List.of()
                    : List.of(EditorCapabilities.owner(ref ->
                    ref instanceof DungeonSelectionRef.StairRef stairRef
                            && Objects.equals(stairRef.stairId(), stairDraftId)));
        }
        return List.of(
                EditorCapabilities.owner(ref -> ref instanceof DungeonSelectionRef.StairRef),
                EditorCapabilities.partFallback(this::roomFloorRef));
    }

    @Override
    public Node statePaneContent() {
        if (activeTool == null) {
            return null;
        }
        return sharedStairPaneContent();
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private void initializeStatePane() {
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
        stairShapeBox.setItems(FXCollections.observableArrayList(GridPathPatternKind.values()));
        stairShapeBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(GridPathPatternKind value) {
                return value == null ? "" : value.label();
            }

            @Override
            public GridPathPatternKind fromString(String string) {
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

    private void renderStairPane() {
        StairDraftResolution resolution = resolveCurrentStairDraft(true);
        stairSummaryLabel.setText(stairSummaryText());
        stairAnchorLabel.setText(stairAnchorText());
        stairFormBox.setManaged(activeTool == DungeonEditorTool.STAIR);
        stairFormBox.setVisible(activeTool == DungeonEditorTool.STAIR);
        GridPathPatternKind shapeKind = currentStairShape();
        updateStairFieldLayout(shapeKind);
        renderExitChips();
        stairExitLevelField.setDisable(stairDraftLoading || activeTool != DungeonEditorTool.STAIR || stairAnchorCell == null);
        stairAddExitButton.setDisable(stairDraftLoading || activeTool != DungeonEditorTool.STAIR || stairAnchorCell == null);
        stairApplyButton.setDisable(activeTool != DungeonEditorTool.STAIR || stairDraftLoading || stairAnchorCell == null);
        stairCancelButton.setDisable(stairDraftLoading || (stairAnchorCell == null && stairDraftId == null));
        stairStatusLabel.setText(stairStatusText(resolution));
    }

    private void updateStairFieldLayout(GridPathPatternKind shapeKind) {
        GridPathPatternKind resolvedShape = shapeKind == null ? GridPathPatternKind.STACK : shapeKind;
        boolean showDirection = resolvedShape.needsDirection();
        boolean showDimension1 = resolvedShape.needsParameter1();
        boolean showDimension2 = resolvedShape.needsParameter2();
        stairDimension1Label.setText(showDimension1 ? resolvedShape.parameter1Label() : "");
        stairDimension2Label.setText(showDimension2 ? resolvedShape.parameter2Label() : "");
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
            if (activeTool == DungeonEditorTool.STAIR && !stairDraftLoading) {
                chip.setOnMouseClicked(event -> selectStairAnchorLevel(level));
            } else {
                chip.setOnMouseClicked(null);
            }
            if (!anchorLevel && activeTool == DungeonEditorTool.STAIR) {
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
        GridPoint anchorPoint = exitPointAtLevel(stair, level);
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
        GridPoint clickedPoint = clickedPoint(ctx);
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
                        .comparingInt((features.world.dungeonmap.model.structures.stair.StairExit exit) ->
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

    private static GridPoint clickedPoint(EditorToolContext ctx) {
        if (ctx == null || ctx.probe() == null) {
            return null;
        }
        return GridPoint.at(ctx.probe().gridCell(), ctx.probe().levelZ());
    }

    private static GridPoint exitPointAtLevel(DungeonStair stair, int level) {
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

    private static int stairExitDistance(GridPoint clickedPoint, GridPoint exitPoint) {
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
            clearStairDraftState(false);
        }
        DungeonStair persistedStair = stairDraftId == null ? null : mapState.activeMap().findStair(stairDraftId);
        if (stairDraftId != null && persistedStair == null) {
            clearStairDraftState(false);
        } else if (!stairDraftDirty) {
            lastResolvedStair = persistedStair;
        }
        if ((activeTool == DungeonEditorTool.STAIR || state.selectedRef() instanceof DungeonSelectionRef.StairRef)
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
        if (ctx != null && ctx.resolvedRef() != null) {
            state.selectRef(ctx.resolvedRef());
        }
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
                throwable -> UiErrorReporter.reportBackgroundFailure("StairTool.handleStairDeletePressed()", throwable));
        return true;
    }

    private void startNewStair(GridPoint cell, int levelZ) {
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
                GridPathPatternSpec.defaultSpec(),
                stairStopLevels);
        refreshStairPreview();
        refreshStatePane();
    }

    private void loadStairEditor(long stairId, Integer preferredAnchorLevel) {
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
                            spec.shapeSpec(),
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
                    UiErrorReporter.reportBackgroundFailure("StairTool.loadStairEditor()", throwable);
                    refreshStatePane();
                });
    }

    private void setStairFields(
            String name,
            GridPathPatternSpec shapeSpec,
            Set<Integer> stopLevels
    ) {
        GridPathPatternSpec resolvedShapeSpec = shapeSpec == null ? GridPathPatternSpec.defaultSpec() : shapeSpec;
        syncingStairFields = true;
        stairNameField.setText(name == null ? "" : name);
        stairShapeBox.setValue(resolvedShapeSpec.kind());
        stairDirectionBox.setValue(resolvedShapeSpec.direction());
        stairDimension1Field.setText(Integer.toString(resolvedShapeSpec.parameter1()));
        stairDimension2Field.setText(Integer.toString(resolvedShapeSpec.parameter2()));
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
                        UiErrorReporter.reportBackgroundFailure("StairTool.commitStairDraft()", throwable);
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
                    UiErrorReporter.reportBackgroundFailure("StairTool.commitStairDraft()", throwable);
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
        stairShapeBox.setValue(GridPathPatternKind.STACK);
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
        if (activeTool != DungeonEditorTool.STAIR
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
        GridPathPatternKind shape = currentStairShape();
        CardinalDirection direction = currentDirection();
        int dimension1 = resolvedDimension(stairDimension1Field.getText(), shape.needsParameter1());
        int dimension2 = resolvedDimension(stairDimension2Field.getText(), shape.needsParameter2());
        GridPathPatternSpec shapeSpec = new GridPathPatternSpec(shape, direction, dimension1, dimension2);
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
                shapeSpec,
                minLevel,
                maxLevel,
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

    private GridPathPatternKind currentStairShape() {
        GridPathPatternKind shape = stairShapeBox.getValue();
        return shape == null ? GridPathPatternKind.STACK : shape;
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

    private DungeonSelectionRef roomFloorRef(EditorToolContext ctx) {
        if (ctx == null || stairFlowActive() || ctx.probe() == null) {
            return null;
        }
        DungeonLayout layout = ctx.activeMap();
        int levelZ = ctx.probe().levelZ();
        GridPoint gridCell = ctx.probe().gridCell();
        if (roomWithFloorAtCell(layout, gridCell, levelZ) == null) {
            return null;
        }
        return new DungeonSelectionRef.FloorCellRef(GridPoint.at(gridCell, levelZ));
    }

    private static Room roomWithFloorAtCell(DungeonLayout layout, GridPoint cell, int levelZ) {
        RoomCluster cluster = layout == null || cell == null ? null : layout.clusterAtCell(cell, levelZ);
        Room room = cluster == null ? null : cluster.structure().roomTopology().roomAt(cell, levelZ);
        return room != null && cluster.structure().roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().contains(cell)
                ? room
                : null;
    }

    private boolean stairFlowActive() {
        return stairDraftLoading || stairDraftId != null || stairAnchorCell != null;
    }

    private void ensureSelectedStairLoaded() {
        if (stairFlowActive()) {
            return;
        }
        if (state.selectedRef() instanceof DungeonSelectionRef.StairRef stairRef && stairRef.stairId() != null) {
            loadStairEditor(stairRef.stairId(), null);
        }
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
                draft.shapeSpec(),
                draft.stopLevels());
        lastResolvedStair = null;
        state.clearPreview();
        refreshStatePane();
    }

    private boolean sharedStairPaneVisible() {
        return state.selectedRef() instanceof DungeonSelectionRef.StairRef
                || activeTool == DungeonEditorTool.STAIR && stairFlowActive();
    }

    private boolean wantsStairEditor(long stairId) {
        return activeTool == DungeonEditorTool.STAIR
                || state.selectedRef() instanceof DungeonSelectionRef.StairRef stairRef
                && Objects.equals(stairRef.stairId(), stairId);
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

    private String stairLabel(Long stairId) {
        DungeonStair stair = stairId == null ? null : mapState.activeMap().findStair(stairId);
        return stair == null ? "Treppe " + stairId : stair.label();
    }

    private static DungeonSelectionRef stairOwnerRef(Long stairId) {
        return stairId == null ? null : new DungeonSelectionRef.StairRef(stairId);
    }

    record StairDragSource(long stairId, DungeonStairApplicationService.StairDraft draft) {
    }

    private record StairDraftResolution(
            DungeonStairApplicationService.StairDraft draft,
            DungeonStair previewStair,
            String validationMessage
    ) {
    }
}
