package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.controls.DungeonPaintMode;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.workflow.DungeonMapLoadingWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.DungeonSelectionEditorWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.DungeonSelectionWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.DungeonSquareEditWorkflowController;
import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public class DungeonEditorView implements AppView {

    private final DungeonEditorInteractionState interactionState = new DungeonEditorInteractionState();
    private final DungeonEditorControls controls = new DungeonEditorControls(interactionState);
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonToolSettingsPane toolSettingsPane = new DungeonToolSettingsPane();
    private final DungeonEditorApplicationService applicationService = new DungeonEditorApplicationService();
    private final DungeonEditorState state = new DungeonEditorState();
    private final DungeonSelectionWorkflowController selectionWorkflowController =
            new DungeonSelectionWorkflowController(canvas, toolSettingsPane, state);
    private final DungeonSquareEditWorkflowController squareEditWorkflowController =
            new DungeonSquareEditWorkflowController(state, interactionState, applicationService, canvas);
    private final DungeonMapDropdowns mapDropdowns = new DungeonMapDropdowns();
    private final VBox statePane = new VBox(8);
    private final DungeonMapLoadingWorkflowController loadingWorkflowController = new DungeonMapLoadingWorkflowController(
            state, interactionState, applicationService, controls, canvas, toolSettingsPane, selectionWorkflowController);
    private final DungeonMapEditingController mapEditingController = new DungeonMapEditingController(
            state, applicationService, mapDropdowns);
    private final DungeonEntityCrudController entityCrudController = new DungeonEntityCrudController(
            state, applicationService, toolSettingsPane);
    private final DungeonConnectionEditingController connectionEditingController = new DungeonConnectionEditingController(
            state, interactionState, applicationService, canvas, selectionWorkflowController);
    private final DungeonEditorInspectorContentFactory inspectorContentFactory = new DungeonEditorInspectorContentFactory(
            state, entityCrudController, connectionEditingController);
    private final DungeonSelectionEditorWorkflowController selectionEditorWorkflowController = new DungeonSelectionEditorWorkflowController(
            state, toolSettingsPane, selectionWorkflowController, entityCrudController);

    public DungeonEditorView(DetailsNavigator detailsNavigator) {
        squareEditWorkflowController.setReloadCurrentMap(loadingWorkflowController::reloadCurrentMap);
        loadingWorkflowController.setOnMapLoaded(squareEditWorkflowController::handleMapLoaded);
        mapEditingController.setReloadMapList(loadingWorkflowController::onShow);
        entityCrudController.setReloadCurrentMap(loadingWorkflowController::reloadCurrentMap);
        connectionEditingController.setReloadCurrentMap(loadingWorkflowController::reloadCurrentMap);
        selectionWorkflowController.setDetailsNavigator(detailsNavigator);
        selectionWorkflowController.setInspectorContentFactory(inspectorContentFactory);
        loadingWorkflowController.setOnEncounterTablesChanged(() -> {
            selectionEditorWorkflowController.syncEncounterTableSelection();
            selectionWorkflowController.refreshInspectorForCurrentSelection();
        });
        loadingWorkflowController.setOnStoredEncountersChanged(() -> {
            selectionEditorWorkflowController.syncFeatureEncounterSelection();
            selectionWorkflowController.refreshInspectorForCurrentSelection();
        });
        statePane.getChildren().add(toolSettingsPane);
        bindControls();
        bindCanvas();
        bindSharedUi();
    }

    @Override
    public Node getMainContent() {
        return canvas;
    }

    @Override
    public String getTitle() {
        return "Dungeoneditor";
    }

    @Override
    public String getIconText() {
        return "\u25a6";
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    public Node getStateContent() {
        ScrollPane scrollPane = new ScrollPane(statePane);
        scrollPane.getStyleClass().add("dungeon-editor-sidebar-scroll");
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        return scrollPane;
    }

    @Override
    public void onShow() {
        loadingWorkflowController.onShow();
    }

    private void bindControls() {
        toolSettingsPane.setBrushPaintModeActive(interactionState.paintMode() == DungeonPaintMode.BRUSH);
        selectionWorkflowController.updateToolMode(interactionState.activeTool());
        controls.setOnMapSelected(mapId -> {
            squareEditWorkflowController.discardPendingSquareEdits();
            loadingWorkflowController.loadMapAsync(mapId);
        });
        controls.setOnNewMapRequested(mapEditingController::showNewMapDropdown);
        controls.setOnEditMapRequested(mapEditingController::showEditMapDropdown);
        interactionState.onPaintModeChanged(mode -> {
            toolSettingsPane.setBrushPaintModeActive(mode == DungeonPaintMode.BRUSH);
            canvas.setActiveTool(interactionState.activeTool());
        });
        interactionState.onWallEditorModeChanged(mode -> canvas.setActiveTool(interactionState.activeTool()));
        interactionState.onPassageEditorModeChanged(mode -> canvas.setActiveTool(interactionState.activeTool()));
        interactionState.onActiveToolChanged(tool -> {
            squareEditWorkflowController.commitPendingSquareEdits();
            selectionWorkflowController.updateToolMode(tool);
            loadingWorkflowController.autoShowForTool(tool);
        });
    }

    private void bindCanvas() {
        canvas.setOnCellClicked(interaction -> selectionWorkflowController.handleCellClick(
                interactionState.activeTool(),
                interaction,
                state.currentMapId(),
                entityCrudController::assignRoomToArea,
                connectionEditingController::createOrSelectEndpoint));
        canvas.setOnCellPainted(squareEditWorkflowController::handleCellPaint);
        canvas.setOnPaintStrokeFinished(squareEditWorkflowController::flushPendingSquareEdits);
        canvas.setOnEdgePainted(squareEditWorkflowController::handleEdgePaint);
        canvas.setOnEdgePaintPathPreview(squareEditWorkflowController::previewWallPaintPath);
        canvas.setOnEdgePaintPathFinished(squareEditWorkflowController::commitWallPaintPath);
        canvas.setOnEdgeStrokeFinished(squareEditWorkflowController::flushPendingWallEdits);
        canvas.setOnEndpointClicked(connectionEditingController::handleEndpointClick);
        canvas.setOnLinkClicked(selectionWorkflowController::showLinkSelection);
        canvas.setBrushSizeSupplier(toolSettingsPane::getBrushSize);
        canvas.setBrushShapeSupplier(toolSettingsPane::getBrushShape);
        canvas.setPaintModeSupplier(interactionState::paintMode);
        canvas.setWallEditorModeSupplier(interactionState::wallEditorMode);
        canvas.setPassageEditorModeSupplier(interactionState::passageEditorMode);
        canvas.setOnEdgeClicked(connectionEditingController::handleEdgeClick);
    }

    private void bindSharedUi() {
        selectionEditorWorkflowController.bindToolSettings();
        toolSettingsPane.linksVisibleCheckBox().selectedProperty()
                .addListener((obs, oldValue, newValue) -> canvas.setShowLinks(newValue));
        toolSettingsPane.endpointsVisibleCheckBox().selectedProperty()
                .addListener((obs, oldValue, newValue) -> canvas.setShowEndpoints(newValue));
        toolSettingsPane.featuresVisibleCheckBox().selectedProperty()
                .addListener((obs, oldValue, newValue) -> canvas.setShowFeatures(newValue));
    }
}
