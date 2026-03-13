package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.toolbar.DungeonColorRenderMode;
import features.world.dungeonmap.ui.editor.workflow.DungeonEditorController;
import features.world.dungeonmap.ui.editor.toolbar.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.DungeonMapQueryService;
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
    private final VBox statePane = new VBox(8);
    private final DungeonEditorController controller;

    public DungeonEditorView(DetailsNavigator detailsNavigator, DungeonMapQueryService queries, DungeonMapCommandService commands) {
        controller = new DungeonEditorController(state, interactionState, controls, canvas, toolSettingsPane, queries, commands, detailsNavigator);
        statePane.getChildren().add(toolSettingsPane);
        controller.initializeUi();
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
        controller.onShow();
    }

    private void bindControls() {
        controls.setOnMapSelected(controller::handleMapSelected);
        controls.setOnNewMapRequested(controller::showNewMapDropdown);
        controls.setOnEditMapRequested(controller::showEditMapDropdown);
        interactionState.onPaintModeChanged(controller::handlePaintModeChanged);
        interactionState.onColorRenderModeChanged(controller::handleColorRenderModeChanged);
        interactionState.onWallEditorModeChanged(ignored -> controller.handleWallEditorModeChanged());
        interactionState.onPassageEditorModeChanged(ignored -> controller.handlePassageEditorModeChanged());
        interactionState.onActiveToolChanged(controller::handleActiveToolChanged);
    }

    private void bindCanvas() {
        canvas.setOnCellClicked(controller::handleCellClicked);
        canvas.setOnCellPainted(controller::handleCellPaint);
        canvas.setOnPaintStrokeFinished(controller::flushPendingSquareEdits);
        canvas.setOnEdgePainted(controller::handleEdgePaint);
        canvas.setOnEdgePaintPathPreview(controller::previewWallPaintPath);
        canvas.setOnEdgePaintPathFinished(controller::commitWallPaintPath);
        canvas.setOnEdgeStrokeFinished(controller::flushPendingWallEdits);
        canvas.setOnEndpointClicked(controller::handleEndpointClick);
        canvas.setOnLinkClicked(controller::showLinkSelection);
        canvas.setBrushSizeSupplier(controller::brushSize);
        canvas.setBrushShapeSupplier(controller::brushShape);
        canvas.setPaintModeSupplier(controller::paintMode);
        canvas.setWallEditorModeSupplier(controller::wallEditorMode);
        canvas.setPassageEditorModeSupplier(controller::passageEditorMode);
        canvas.setOnEdgeClicked(controller::handleEdgeClick);
    }

    private void bindSharedUi() {
        toolSettingsPane.setOnLinksVisibilityChanged(controller::setShowLinks);
        toolSettingsPane.setOnEndpointsVisibilityChanged(controller::setShowEndpoints);
        toolSettingsPane.setOnFeaturesVisibilityChanged(controller::setShowFeatures);
        toolSettingsPane.setOnColorRenderModeChanged(controller::setColorRenderMode);
    }
}
