package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.panes.DungeonDetailsPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public class DungeonEditorView implements AppView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonDetailsPane detailsPane = new DungeonDetailsPane();
    private final DungeonToolSettingsPane toolSettingsPane = new DungeonToolSettingsPane();
    private final DungeonEditorApplicationService applicationService = new DungeonEditorApplicationService();
    private final DungeonPaintSession paintSession = new DungeonPaintSession(canvas::previewPaint);
    private final DungeonEditorState state = new DungeonEditorState();
    private final DungeonSelectionWorkflowController selectionWorkflowController =
            new DungeonSelectionWorkflowController(canvas, detailsPane, toolSettingsPane, state);
    private final DungeonSquareEditWorkflowController squareEditWorkflowController =
            new DungeonSquareEditWorkflowController(state, applicationService, controls, toolSettingsPane, paintSession);
    private final DungeonMapDropdowns mapDropdowns = new DungeonMapDropdowns();
    private final DungeonMapLoadingWorkflowController loadingWorkflowController = new DungeonMapLoadingWorkflowController(
            state, applicationService, controls, canvas, detailsPane, toolSettingsPane, selectionWorkflowController);
    private final DungeonEntityEditingWorkflowController entityEditingWorkflowController = new DungeonEntityEditingWorkflowController(
            state, applicationService, controls, toolSettingsPane, selectionWorkflowController, mapDropdowns);
    private final DungeonDetailsWorkflowController detailsWorkflowController = new DungeonDetailsWorkflowController(
            state, detailsPane, toolSettingsPane, selectionWorkflowController, entityEditingWorkflowController, loadingWorkflowController);

    public DungeonEditorView(DetailsNavigator detailsNavigator) {
        loadingWorkflowController.setOnEncounterTablesChanged(detailsWorkflowController::syncEncounterTableSelection);
        squareEditWorkflowController.setReloadCurrentMap(() -> loadingWorkflowController.loadMapAsync(state.currentMapId()));
        entityEditingWorkflowController.setReloadCallbacks(
                () -> loadingWorkflowController.loadMapAsync(state.currentMapId()),
                loadingWorkflowController::onShow);
        selectionWorkflowController.setDetailsNavigator(detailsNavigator);
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

    public Node getDetailsContent() {
        ScrollPane scrollPane = new ScrollPane(detailsPane);
        scrollPane.getStyleClass().add("dungeon-editor-sidebar-scroll");
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        return scrollPane;
    }

    @Override
    public Node getStateContent() {
        ScrollPane scrollPane = new ScrollPane(toolSettingsPane);
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
        controls.setOnNewMapRequested(entityEditingWorkflowController::showNewMapDropdown);
        controls.setOnEditMapRequested(entityEditingWorkflowController::showEditMapDropdown);
        controls.setOnToolChanged(tool -> {
            squareEditWorkflowController.commitPendingSquareEdits();
            selectionWorkflowController.updateToolMode(tool);
            loadingWorkflowController.autoShowForTool(tool);
        });
    }

    private void bindCanvas() {
        canvas.setOnCellClicked(entityEditingWorkflowController::handleCellClick);
        canvas.setOnCellPainted(squareEditWorkflowController::handleCellPaint);
        canvas.setOnPaintStrokeFinished(squareEditWorkflowController::flushPendingSquareEdits);
        canvas.setOnEndpointClicked(entityEditingWorkflowController::handleEndpointClick);
        canvas.setOnLinkClicked(selectionWorkflowController::showLinkSelection);
        canvas.setBrushSizeSupplier(toolSettingsPane::getBrushSize);
        canvas.setBrushShapeSupplier(toolSettingsPane::getBrushShape);
        canvas.setOnEdgeClicked(entityEditingWorkflowController::handleEdgeClick);
    }

    private void bindSharedUi() {
        detailsWorkflowController.bindToolSettings();
        detailsWorkflowController.bindDetailsPane();
        toolSettingsPane.linksVisibleCheckBox().selectedProperty()
                .addListener((obs, oldValue, newValue) -> canvas.setShowLinks(newValue));
        toolSettingsPane.endpointsVisibleCheckBox().selectedProperty()
                .addListener((obs, oldValue, newValue) -> canvas.setShowEndpoints(newValue));
    }
}
