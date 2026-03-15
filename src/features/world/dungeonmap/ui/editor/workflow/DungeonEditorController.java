package features.world.dungeonmap.ui.editor.workflow;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.editing.BrushShape;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.editor.chrome.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.state.DungeonColorRenderMode;
import features.world.dungeonmap.ui.editor.state.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.state.DungeonPaintMode;
import features.world.dungeonmap.ui.editor.state.WallEditorMode;
import features.world.dungeonmap.ui.editor.chrome.inspector.DungeonEditorInspectorContentFactory;
import features.world.dungeonmap.ui.editor.chrome.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import features.world.dungeonmap.ui.shared.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.workflow.tools.EditorMessageBus;
import features.world.dungeonmap.ui.editor.workflow.tools.ToolSettingsBinding;
import features.world.dungeonmap.ui.editor.workflow.catalog.DungeonCatalogLoader;
import features.world.dungeonmap.ui.editor.workflow.connection.DungeonConnectionWorkflow;
import features.world.dungeonmap.ui.editor.workflow.entity.DungeonEntityWorkflow;
import features.world.dungeonmap.ui.editor.workflow.map.DungeonMapActions;
import features.world.dungeonmap.ui.editor.workflow.map.DungeonMapLoader;
import features.world.dungeonmap.ui.editor.workflow.paint.DungeonSquareEditWorkflow;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionController;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionInspectorPublisher;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionRestorer;
import features.world.dungeonmap.ui.editor.workflow.tools.DungeonCanvasStateMapper;
import features.world.dungeonmap.ui.shared.map.DungeonMapControlsPane;
import features.world.dungeonmap.ui.shared.map.DungeonMapDropdownPresenter;
import ui.shell.DetailsNavigator;

import java.util.List;

public final class DungeonEditorController {

    private final DungeonEditorState state;
    private final DungeonEditorInteractionState interactionState;
    private final DungeonMapPane canvas;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionController selectionController;
    private final DungeonSquareEditWorkflow squareEditWorkflow;
    private final DungeonMapActions mapActions;
    private final DungeonEntityWorkflow entityWorkflow;
    private final DungeonConnectionWorkflow connectionWorkflow;
    private final ToolSettingsBinding toolSettingsBinding;
    private final DungeonSelectionRestorer selectionRestorer;
    private final DungeonMapLoader mapLoader;
    private final DungeonCatalogLoader catalogLoader;

    public DungeonEditorController(
            DungeonEditorState state,
            DungeonEditorInteractionState interactionState,
            DungeonEditorControls controls,
            DungeonMapPane canvas,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonMapQueryService queries,
            DungeonMapCommandService commands,
            DetailsNavigator detailsNavigator
    ) {
        this.state = state;
        this.interactionState = interactionState;
        this.canvas = canvas;
        this.toolSettingsPane = toolSettingsPane;

        EditorMessageBus workflowMessages = new EditorMessageBus(toolSettingsPane);
        selectionController = new DungeonSelectionController(canvas, toolSettingsPane, state, workflowMessages);
        squareEditWorkflow = new DungeonSquareEditWorkflow(state, interactionState, canvas, commands, this::reloadCurrentMap);
        mapActions = new DungeonMapActions(state, new DungeonMapDropdownPresenter(), commands, this::onShow);
        entityWorkflow = new DungeonEntityWorkflow(state, toolSettingsPane, selectionController, workflowMessages, commands, this::reloadCurrentMap);
        connectionWorkflow = new DungeonConnectionWorkflow(
                state,
                selectionController,
                commands,
                this::reloadCurrentMap);
        var inspectorContentFactory = new DungeonEditorInspectorContentFactory(
                state,
                entityWorkflow);
        selectionController.setInspectorPublisher(new DungeonSelectionInspectorPublisher(detailsNavigator, inspectorContentFactory));
        toolSettingsBinding = new ToolSettingsBinding(state, toolSettingsPane, selectionController, entityWorkflow);
        selectionRestorer = new DungeonSelectionRestorer(state, toolSettingsPane, selectionController, interactionState::activeTool);
        mapLoader = new DungeonMapLoader(
                state,
                controls,
                canvas,
                toolSettingsPane,
                selectionController,
                selectionRestorer,
                queries,
                squareEditWorkflow::handleMapLoaded);
        catalogLoader = new DungeonCatalogLoader(
                state,
                toolSettingsPane,
                selectionController::refreshInspectorForCurrentSelection,
                selectionController::refreshInspectorForCurrentSelection);
        toolSettingsBinding.bindToolSettings();
    }

    public void initializeUi() {
        toolSettingsPane.setBrushPaintModeActive(interactionState.activeTool() == DungeonEditorTool.FEATURE
                || interactionState.paintMode() == DungeonPaintMode.BRUSH);
        toolSettingsPane.setColorRenderMode(interactionState.colorRenderMode());
        toolSettingsPane.setSelectedFeatureCategory(interactionState.activeFeatureCategory());
        canvas.setColorRenderMode(DungeonCanvasStateMapper.toCanvasColorMode(interactionState.colorRenderMode()));
        canvas.setActiveTool(DungeonCanvasStateMapper.toCanvasTool(interactionState.activeTool()));
        toolSettingsPane.setActiveTool(interactionState.activeTool());
        canvas.setShowFeatures(toolSettingsPane.featuresVisible());
    }

    public void onShow() {
        catalogLoader.loadCatalogs();
        mapLoader.onShow();
    }

    public void handleMapSelected(Long mapId) {
        squareEditWorkflow.discardPendingSquareEdits();
        mapLoader.loadMapAsync(mapId);
    }

    public void showNewMapDropdown(javafx.scene.Node anchor) {
        mapActions.showNewMapDropdown(anchor);
    }

    public void showEditMapDropdown(DungeonMapControlsPane.MapActionRequest request) {
        mapActions.showEditMapDropdown(request);
    }

    public void handlePaintModeChanged(DungeonPaintMode mode) {
        toolSettingsPane.setBrushPaintModeActive(interactionState.activeTool() == DungeonEditorTool.FEATURE || mode == DungeonPaintMode.BRUSH);
        canvas.setActiveTool(DungeonCanvasStateMapper.toCanvasTool(interactionState.activeTool()));
    }

    public void handleColorRenderModeChanged(DungeonColorRenderMode mode) {
        toolSettingsPane.setColorRenderMode(mode);
        canvas.setColorRenderMode(DungeonCanvasStateMapper.toCanvasColorMode(mode));
    }

    public void handleWallEditorModeChanged() {
        canvas.setActiveTool(DungeonCanvasStateMapper.toCanvasTool(interactionState.activeTool()));
    }

    public void handleFeatureCategoryChanged() {
        toolSettingsPane.setSelectedFeatureCategory(interactionState.activeFeatureCategory());
    }

    public void handleActiveToolChanged(DungeonEditorTool tool) {
        squareEditWorkflow.commitPendingSquareEdits();
        DungeonColorRenderMode preferredColorMode = tool.preferredColorRenderMode();
        if (preferredColorMode != null) {
            interactionState.setColorRenderMode(preferredColorMode);
        }
        canvas.setActiveTool(DungeonCanvasStateMapper.toCanvasTool(tool));
        toolSettingsPane.setActiveTool(tool);
        toolSettingsPane.setBrushPaintModeActive(tool == DungeonEditorTool.FEATURE || interactionState.paintMode() == DungeonPaintMode.BRUSH);
        selectionRestorer.autoShowForTool(tool);
    }

    public void handleCellClicked(DungeonMapPane.CellInteraction interaction) {
        switch (interactionState.activeTool().cellClickAction()) {
            case SELECT_SQUARE -> selectionController.handleSquareClick(interaction, state.currentMapId());
            case ASSIGN_ROOM_AREA -> entityWorkflow.handleAreaAssignClick(interaction, state.currentMapId());
        }
    }

    public void handleCellPaint(DungeonMapPane.CellInteraction interaction) {
        squareEditWorkflow.handleCellPaint(interaction);
    }

    public void flushPendingSquareEdits() {
        squareEditWorkflow.flushPendingSquareEdits();
    }

    public void handleEdgePaint(DungeonMapPane.EdgeInteraction interaction) {
        squareEditWorkflow.handleEdgePaint(interaction);
    }

    public void previewWallPaintPath(List<DungeonMapPane.EdgeInteraction> path) {
        squareEditWorkflow.previewWallPaintPath(path);
    }

    public void commitWallPaintPath(List<DungeonMapPane.EdgeInteraction> path) {
        squareEditWorkflow.commitWallPaintPath(path);
    }

    public void flushPendingWallEdits() {
        squareEditWorkflow.flushPendingWallEdits();
    }

    public void handleFeatureClick(DungeonFeature feature) {
        selectionController.selectFeature(feature);
    }

    public void handleConnectionClicked(Long connectionId) {
        connectionWorkflow.selectConnection(connectionId);
    }

    public void handleConnectionPointMoved(DungeonMapPane.ConnectionPointMoveRequest request) {
        connectionWorkflow.moveConnectionPoint(request);
    }

    public void handleConnectionPointInserted(DungeonMapPane.ConnectionPointInsertRequest request) {
        connectionWorkflow.insertConnectionPoint(request);
    }

    public void handleConnectionPointDeleted(DungeonMapPane.ConnectionPointDeleteRequest request) {
        connectionWorkflow.deleteConnectionPoint(request);
    }

    public int brushSize() {
        return toolSettingsPane.getBrushSize();
    }

    public BrushShape brushShape() {
        return toolSettingsPane.getBrushShape();
    }

    public DungeonPaintMode paintMode() {
        return interactionState.paintMode();
    }

    public WallEditorMode wallEditorMode() {
        return interactionState.wallEditorMode();
    }

    public void setShowFeatures(boolean showFeatures) {
        canvas.setShowFeatures(showFeatures);
    }

    public void setColorRenderMode(DungeonColorRenderMode mode) {
        interactionState.setColorRenderMode(mode);
    }

    public void reloadCurrentMap() {
        mapLoader.reloadCurrentMap();
    }

    public void reloadCurrentMap(DungeonSelectionRestoreRequest request) {
        mapLoader.reloadCurrentMap(request);
    }
}
