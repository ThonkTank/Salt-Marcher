package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.panes.DungeonDetailsPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public class DungeonEditorView implements AppView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonDetailsPane detailsPane = new DungeonDetailsPane();
    private final DungeonToolSettingsPane toolSettingsPane = new DungeonToolSettingsPane();
    private final DungeonEditorApplicationService applicationService = new DungeonEditorApplicationService();
    private final DungeonPaintSession paintSession = new DungeonPaintSession(canvas);
    private final DungeonEditorState state = new DungeonEditorState();
    private final DungeonSelectionWorkflowController selectionWorkflowController =
            new DungeonSelectionWorkflowController(canvas, detailsPane, toolSettingsPane, state);
    private final DungeonMapDropdowns mapDropdowns = new DungeonMapDropdowns();
    private final VBox statePane = new VBox(8);
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
        VBox.setVgrow(detailsPane, Priority.ALWAYS);
        statePane.getChildren().addAll(toolSettingsPane, detailsPane);
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
            editingWorkflowController.discardPendingPaints();
            loadingWorkflowController.loadMapAsync(mapId);
        });
        controls.setOnNewMapRequested(editingWorkflowController::showNewMapDropdown);
        controls.setOnEditMapRequested(editingWorkflowController::showEditMapDropdown);
        controls.setOnToolChanged(tool -> {
            editingWorkflowController.commitPendingPaints();
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
        canvas.setBrushSizeSupplier(toolSettingsPane::getBrushSize);
        canvas.setBrushShapeSupplier(toolSettingsPane::getBrushShape);
        canvas.setOnEdgeClicked(editingWorkflowController::handleEdgeClick);
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
