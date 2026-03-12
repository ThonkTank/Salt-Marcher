package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.panes.DungeonSelectionEditorPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public class DungeonEditorView implements AppView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonSelectionEditorPane selectionEditorPane = new DungeonSelectionEditorPane();
    private final DungeonToolSettingsPane toolSettingsPane = new DungeonToolSettingsPane();
    private final DungeonEditorApplicationService applicationService = new DungeonEditorApplicationService();
    private final DungeonPaintSession paintSession = new DungeonPaintSession(canvas::previewPaint);
    private final DungeonWallPaintSession wallPaintSession = new DungeonWallPaintSession(canvas::previewCommittedWallEdits);
    private final DungeonEditorState state = new DungeonEditorState();
    private final DungeonSelectionWorkflowController selectionWorkflowController =
            new DungeonSelectionWorkflowController(canvas, selectionEditorPane, toolSettingsPane, state);
    private final DungeonSquareEditWorkflowController squareEditWorkflowController =
            new DungeonSquareEditWorkflowController(state, applicationService, canvas, controls, toolSettingsPane, paintSession, wallPaintSession);
    private final DungeonMapDropdowns mapDropdowns = new DungeonMapDropdowns();
    private final VBox statePane = new VBox(8);
    private final DungeonMapLoadingWorkflowController loadingWorkflowController = new DungeonMapLoadingWorkflowController(
            state, applicationService, controls, canvas, selectionEditorPane, toolSettingsPane, selectionWorkflowController);
    private final DungeonMapEditingController mapEditingController = new DungeonMapEditingController(
            state, applicationService, mapDropdowns);
    private final DungeonEntityCrudController entityCrudController = new DungeonEntityCrudController(
            state, applicationService, toolSettingsPane);
    private final DungeonConnectionEditingController connectionEditingController = new DungeonConnectionEditingController(
            state, applicationService, canvas, controls, selectionWorkflowController);
    private final DungeonEditorInspectorContentFactory inspectorContentFactory = new DungeonEditorInspectorContentFactory(
            state, entityCrudController);
    private final DungeonSelectionEditorWorkflowController selectionEditorWorkflowController = new DungeonSelectionEditorWorkflowController(
            state, selectionEditorPane, toolSettingsPane, selectionWorkflowController, entityCrudController, connectionEditingController, loadingWorkflowController);

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
        controls.setOnMapSelected(mapId -> {
            squareEditWorkflowController.discardPendingSquareEdits();
            loadingWorkflowController.loadMapAsync(mapId);
        });
        controls.setOnNewMapRequested(mapEditingController::showNewMapDropdown);
        controls.setOnEditMapRequested(mapEditingController::showEditMapDropdown);
        controls.setOnToolChanged(tool -> {
            squareEditWorkflowController.commitPendingSquareEdits();
            selectionWorkflowController.updateToolMode(tool);
            loadingWorkflowController.autoShowForTool(tool);
        });
    }

    private void bindCanvas() {
        canvas.setOnCellClicked(interaction -> selectionWorkflowController.handleCellClick(
                controls.getActiveTool(),
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
        canvas.setWallEditorModeSupplier(toolSettingsPane::getWallEditorMode);
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
