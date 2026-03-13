package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.controls.DungeonPaintMode;
import features.world.dungeonmap.ui.editor.inspector.DungeonEditorInspectorContentFactory;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.workflow.DungeonEditorWorkflow;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonConnectionEditingController;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonEntityCrudController;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonMapEditingController;
import features.world.dungeonmap.ui.editor.workflow.editing.DungeonSquareEditWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.messaging.DungeonWorkflowMessageController;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonLinkWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionEditorWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionInspectorPublisher;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionWorkflowController;
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
    private final DungeonEditorState state = new DungeonEditorState();
    private final DungeonWorkflowMessageController workflowMessageController = new DungeonWorkflowMessageController(toolSettingsPane);
    private final DungeonLinkWorkflowController linkWorkflowController = new DungeonLinkWorkflowController(canvas, toolSettingsPane);
    private final DungeonSelectionWorkflowController selectionWorkflowController =
            new DungeonSelectionWorkflowController(canvas, toolSettingsPane, state, workflowMessageController);
    private final DungeonSquareEditWorkflowController squareEditWorkflowController =
            new DungeonSquareEditWorkflowController(state, interactionState, canvas);
    private final DungeonMapDropdowns mapDropdowns = new DungeonMapDropdowns();
    private final VBox statePane = new VBox(8);
    private final DungeonMapEditingController mapEditingController = new DungeonMapEditingController(
            state, mapDropdowns);
    private final DungeonEntityCrudController entityCrudController = new DungeonEntityCrudController(
            state, toolSettingsPane, selectionWorkflowController, workflowMessageController);
    private final DungeonConnectionEditingController connectionEditingController = new DungeonConnectionEditingController(
            state, interactionState, canvas, selectionWorkflowController, linkWorkflowController, workflowMessageController);
    private final DungeonEditorInspectorContentFactory inspectorContentFactory = new DungeonEditorInspectorContentFactory(
            state, entityCrudController, connectionEditingController);
    private final DungeonSelectionEditorWorkflowController selectionEditorWorkflowController = new DungeonSelectionEditorWorkflowController(
            state, toolSettingsPane, selectionWorkflowController, linkWorkflowController, entityCrudController);
    private final DungeonEditorWorkflow editorWorkflow = new DungeonEditorWorkflow(
            state,
            interactionState,
            controls,
            canvas,
            toolSettingsPane,
            selectionWorkflowController,
            linkWorkflowController,
            squareEditWorkflowController,
            mapEditingController,
            entityCrudController,
            connectionEditingController,
            selectionEditorWorkflowController);

    public DungeonEditorView(DetailsNavigator detailsNavigator) {
        selectionWorkflowController.setInspectorPublisher(new DungeonSelectionInspectorPublisher(detailsNavigator, inspectorContentFactory));
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
        editorWorkflow.onShow();
    }

    private void bindControls() {
        toolSettingsPane.setBrushPaintModeActive(interactionState.paintMode() == DungeonPaintMode.BRUSH);
        toolSettingsPane.setColorRenderMode(interactionState.colorRenderMode());
        canvas.setColorRenderMode(interactionState.colorRenderMode());
        canvas.setActiveTool(interactionState.activeTool());
        toolSettingsPane.setActiveTool(interactionState.activeTool());
        controls.setOnMapSelected(mapId -> {
            squareEditWorkflowController.discardPendingSquareEdits();
            editorWorkflow.loadMapAsync(mapId);
        });
        controls.setOnNewMapRequested(mapEditingController::showNewMapDropdown);
        controls.setOnEditMapRequested(mapEditingController::showEditMapDropdown);
        interactionState.onPaintModeChanged(mode -> {
            toolSettingsPane.setBrushPaintModeActive(mode == DungeonPaintMode.BRUSH);
            canvas.setActiveTool(interactionState.activeTool());
        });
        interactionState.onColorRenderModeChanged(mode -> {
            toolSettingsPane.setColorRenderMode(mode);
            canvas.setColorRenderMode(mode);
        });
        interactionState.onWallEditorModeChanged(mode -> canvas.setActiveTool(interactionState.activeTool()));
        interactionState.onPassageEditorModeChanged(mode -> canvas.setActiveTool(interactionState.activeTool()));
        interactionState.onActiveToolChanged(tool -> {
            squareEditWorkflowController.commitPendingSquareEdits();
            DungeonColorRenderMode preferredColorMode = tool.preferredColorRenderMode();
            if (preferredColorMode != null) {
                interactionState.setColorRenderMode(preferredColorMode);
            }
            canvas.setActiveTool(tool);
            linkWorkflowController.cancelPendingLink();
            toolSettingsPane.setActiveTool(tool);
            editorWorkflow.autoShowForTool(tool);
        });
    }

    private void bindCanvas() {
        canvas.setOnCellClicked(interaction -> {
            switch (interactionState.activeTool().cellClickAction()) {
                case SELECT_SQUARE -> selectionWorkflowController.handleSquareClick(interaction, state.currentMapId());
                case ASSIGN_ROOM_AREA -> entityCrudController.handleAreaAssignClick(interaction, state.currentMapId());
                case CREATE_OR_SELECT_ENDPOINT -> connectionEditingController.createOrSelectEndpoint(interaction.square());
            }
        });
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
        canvas.setShowLinks(toolSettingsPane.linksVisible());
        canvas.setShowEndpoints(toolSettingsPane.endpointsVisible());
        canvas.setShowFeatures(toolSettingsPane.featuresVisible());
        toolSettingsPane.setOnLinksVisibilityChanged(canvas::setShowLinks);
        toolSettingsPane.setOnEndpointsVisibilityChanged(canvas::setShowEndpoints);
        toolSettingsPane.setOnFeaturesVisibilityChanged(canvas::setShowFeatures);
        toolSettingsPane.setOnColorRenderModeChanged(interactionState::setColorRenderMode);
    }
}
