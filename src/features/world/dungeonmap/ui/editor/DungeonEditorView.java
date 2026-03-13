package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.workflow.DungeonEditorCoordinator;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.service.DungeonMapCommands;
import features.world.dungeonmap.service.DungeonMapQueries;
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
    private final DungeonEditorCoordinator coordinator;

    public DungeonEditorView(DetailsNavigator detailsNavigator, DungeonMapQueries queries, DungeonMapCommands commands) {
        coordinator = new DungeonEditorCoordinator(state, interactionState, controls, canvas, toolSettingsPane, queries, commands, detailsNavigator);
        statePane.getChildren().add(toolSettingsPane);
        coordinator.initializeUi();
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
        coordinator.onShow();
    }

    private void bindControls() {
        controls.setOnMapSelected(coordinator::handleMapSelected);
        controls.setOnNewMapRequested(coordinator::showNewMapDropdown);
        controls.setOnEditMapRequested(coordinator::showEditMapDropdown);
        interactionState.onPaintModeChanged(coordinator::handlePaintModeChanged);
        interactionState.onColorRenderModeChanged(coordinator::handleColorRenderModeChanged);
        interactionState.onWallEditorModeChanged(ignored -> coordinator.handleWallEditorModeChanged());
        interactionState.onPassageEditorModeChanged(ignored -> coordinator.handlePassageEditorModeChanged());
        interactionState.onActiveToolChanged(coordinator::handleActiveToolChanged);
    }

    private void bindCanvas() {
        canvas.setOnCellClicked(coordinator::handleCellClicked);
        canvas.setOnCellPainted(coordinator::handleCellPaint);
        canvas.setOnPaintStrokeFinished(coordinator::flushPendingSquareEdits);
        canvas.setOnEdgePainted(coordinator::handleEdgePaint);
        canvas.setOnEdgePaintPathPreview(coordinator::previewWallPaintPath);
        canvas.setOnEdgePaintPathFinished(coordinator::commitWallPaintPath);
        canvas.setOnEdgeStrokeFinished(coordinator::flushPendingWallEdits);
        canvas.setOnEndpointClicked(coordinator::handleEndpointClick);
        canvas.setOnLinkClicked(coordinator::showLinkSelection);
        canvas.setBrushSizeSupplier(coordinator::brushSize);
        canvas.setBrushShapeSupplier(coordinator::brushShape);
        canvas.setPaintModeSupplier(coordinator::paintMode);
        canvas.setWallEditorModeSupplier(coordinator::wallEditorMode);
        canvas.setPassageEditorModeSupplier(coordinator::passageEditorMode);
        canvas.setOnEdgeClicked(coordinator::handleEdgeClick);
    }

    private void bindSharedUi() {
        toolSettingsPane.setOnLinksVisibilityChanged(coordinator::setShowLinks);
        toolSettingsPane.setOnEndpointsVisibilityChanged(coordinator::setShowEndpoints);
        toolSettingsPane.setOnFeaturesVisibilityChanged(coordinator::setShowFeatures);
        toolSettingsPane.setOnColorRenderModeChanged(coordinator::setColorRenderMode);
    }
}
