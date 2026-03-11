package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.panes.DungeonDetailsPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public class DungeonEditorView implements AppView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonDetailsPane detailsPane = new DungeonDetailsPane();
    private final DungeonToolSettingsPane toolSettingsPane = new DungeonToolSettingsPane();
    private final DungeonEditorApplicationService applicationService = new DungeonEditorApplicationService();
    private final DungeonPaintSession paintSession = new DungeonPaintSession(canvas);
    private final DungeonSelectionWorkflowController selectionWorkflowController =
            new DungeonSelectionWorkflowController(canvas, detailsPane, toolSettingsPane);
    private final DungeonMapDropdowns mapDropdowns = new DungeonMapDropdowns();
    private final DungeonEditorState state = new DungeonEditorState();
    private final DungeonMapLoadingWorkflowController loadingWorkflowController = new DungeonMapLoadingWorkflowController(
            state, applicationService, controls, canvas, detailsPane, toolSettingsPane, selectionWorkflowController);
    private final DungeonEditingWorkflowController editingWorkflowController = new DungeonEditingWorkflowController(
            state, applicationService, controls, toolSettingsPane, detailsPane, selectionWorkflowController, paintSession, mapDropdowns);
    private final DungeonDetailsWorkflowController detailsWorkflowController = new DungeonDetailsWorkflowController(
            state, detailsPane, toolSettingsPane, selectionWorkflowController, editingWorkflowController, loadingWorkflowController);

    public DungeonEditorView(DetailsNavigator detailsNavigator) {
        loadingWorkflowController.setOnEncounterTablesChanged(detailsWorkflowController::syncEncounterTableSelection);
        editingWorkflowController.setReloadCallbacks(
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

    @Override
    public Node getStateContent() {
        return toolSettingsPane;
    }

    @Override
    public void onShow() {
        loadingWorkflowController.onShow();
    }

    private void bindControls() {
        controls.setOnMapSelected(loadingWorkflowController::loadMapAsync);
        controls.setOnNewMapRequested(editingWorkflowController::showNewMapDropdown);
        controls.setOnEditMapRequested(editingWorkflowController::showEditMapDropdown);
        controls.setOnToolChanged(tool -> {
            selectionWorkflowController.updateToolMode(tool);
            loadingWorkflowController.autoShowForTool(tool);
        });
    }

    private void bindCanvas() {
        canvas.setOnCellClicked(editingWorkflowController::handleCellClick);
        canvas.setOnCellPainted(editingWorkflowController::handleCellPaint);
        canvas.setOnPaintStrokeFinished(editingWorkflowController::flushPendingPaints);
        canvas.setOnEndpointClicked(editingWorkflowController::handleEndpointClick);
        canvas.setOnLinkClicked(selectionWorkflowController::showLinkSelection);
        canvas.setBrushShapeSupplier(toolSettingsPane::getBrushShape);
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
