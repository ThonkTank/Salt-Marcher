package features.world.dungeonmap.editor.workspace.ui;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonViewMode;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.port.DungeonEditorWorkspaceSink;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneInteractionSink;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonWallPathCommit;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonWallPathSessionState;
import features.world.dungeonmap.editor.workspace.ui.graph.DungeonGraphPane;
import features.world.dungeonmap.editor.workspace.ui.grid.DungeonGridPane;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.view.model.DungeonViewState;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasBounds;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;
import features.world.dungeonmap.canvas.rendering.DungeonViewportController;
import features.world.dungeonmap.canvas.rendering.DungeonWorkspaceRenderState;
import javafx.geometry.Point2D;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;

import java.util.Objects;

public final class DungeonEditorSplitWorkspace extends BorderPane {

    private final DungeonCanvasCamera camera = new DungeonCanvasCamera(32);
    private final DungeonViewportController viewport = new DungeonViewportController(camera);
    private final DungeonGridPane gridPane;
    private final DungeonGraphPane graphPane;
    private final DungeonEditorPaneGroup panes;
    private final StackPane panesContainer;
    private final DungeonWallPathSessionState wallPathState;

    private DungeonEditorWorkspaceSink sink = DungeonEditorWorkspaceSink.NO_OP;
    private CorridorDoorHandle selectedCorridorDoorHandle;

    private DungeonWorkspaceRenderState renderState;
    private DungeonLayout layout;
    private DungeonSelection selectedTarget;
    private DungeonRuntimeLocation activeLocation;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private DungeonEditorTool editorTool = DungeonEditorTool.SELECT;

    public DungeonEditorSplitWorkspace() {
        this.gridPane = new DungeonGridPane(camera);
        this.graphPane = new DungeonGraphPane(camera);
        this.wallPathState = gridPane.wallPathState();
        this.panes = new DungeonEditorPaneGroup(gridPane, graphPane);
        this.panesContainer = new StackPane(gridPane, graphPane);
        setCenter(panesContainer);
        panes.setEditable(true);
        installInteractionSinks(DungeonEditorWorkspaceSink.NO_OP);
        panesContainer.widthProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        panesContainer.heightProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        applyViewMode();
    }

    public void showLayout(DungeonViewState viewState) {
        DungeonLayout nextLayout = viewState == null ? null : viewState.layout();
        boolean resetView = viewport.shouldResetView(nextLayout);
        this.renderState = DungeonWorkspaceRenderState.from(nextLayout, renderState);
        DungeonLayoutRenderData renderData = renderState == null ? null : renderState.renderData();
        DungeonCanvasBounds bounds = renderState == null ? DungeonCanvasBounds.defaultBounds() : renderState.bounds();
        this.layout = nextLayout;
        viewport.updateState(nextLayout, bounds);
        this.selectedTarget = viewState == null ? null : viewState.selectedTarget();
        this.activeLocation = viewState == null ? null : viewState.activeLocation();
        panes.showLayout(viewState, renderData);
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle);
        refreshViewport(resetView);
    }

    public void setEditable(boolean editable) {
        panes.setEditable(editable);
    }

    public void updateSelection(DungeonViewState viewState) {
        this.selectedTarget = viewState == null ? null : viewState.selectedTarget();
        this.activeLocation = viewState == null ? null : viewState.activeLocation();
        panes.updateSelection(viewState, viewMode);
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle);
    }

    public void setInteractionSinks(DungeonEditorWorkspaceSink sink) {
        installInteractionSinks(sink == null ? DungeonEditorWorkspaceSink.NO_OP : sink);
    }

    public void setViewMode(DungeonViewMode viewMode) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (this.viewMode == nextViewMode) {
            return;
        }
        this.viewMode = nextViewMode;
        applyViewMode();
    }

    public DungeonWallPathSessionState wallPathState() {
        return wallPathState;
    }

    public void setSelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        applySelectedCorridorDoorHandle(handle);
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        this.editorTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        panes.setEditorTool(this.editorTool);
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle);
    }

    private void applyViewMode() {
        panes.setVisibleViewMode(viewMode);
        panes.updateActiveSelection(viewMode, new DungeonViewState(layout, selectedTarget, activeLocation));
        panes.setEditorTool(editorTool);
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle);
    }

    private void applySelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        panes.setSelectedCorridorDoorHandle(handle);
        selectedCorridorDoorHandle = panes.selectedCorridorDoorHandle();
    }

    private void installInteractionSinks(DungeonEditorWorkspaceSink sink) {
        this.sink = Objects.requireNonNull(sink, "sink");
        panes.bindInteractionSinks(
                createPaneInteractionForwarder(),
                createPaneInteractionForwarder());
        installWallPathCallbacks(this.sink);
    }

    private DungeonPaneInteractionSink createPaneInteractionForwarder() {
        return new DungeonEditorPaneInteractionForwarder(
                sink,
                handle -> {
                    applySelectedCorridorDoorHandle(handle);
                    sink.onCorridorDoorSelectionChanged(selectedCorridorDoorHandle);
                },
                this::beginPan,
                this::updatePan,
                this::zoomAt);
    }

    private void installWallPathCallbacks(DungeonEditorWorkspaceSink sink) {
        wallPathState.setOnWallPathStateChanged(sink::onWallPathStateChanged);
        wallPathState.setOnWallPathCommitRequested((edgeRefs, nextAnchor) ->
                sink.onWallPathCommitRequested(
                        new DungeonWallPathCommit(edgeRefs, nextAnchor),
                        gridPane.activeEditorTool() == DungeonEditorTool.CLUSTER_WALL_DELETE));
    }

    private void beginPan(Point2D point) {
        viewport.beginPan(point);
    }

    private void updatePan(Point2D point) {
        viewport.updatePan(point, this::refreshPanes);
    }

    private void zoomAt(double screenX, double screenY, double factor) {
        viewport.zoomAt(screenX, screenY, factor, this::refreshPanes);
    }

    private void refreshViewport(boolean resetView) {
        viewport.refreshViewport(panesContainer.getWidth(), panesContainer.getHeight(), resetView, this::refreshPanes);
    }

    private void refreshPanes() {
        panes.refreshViewport(viewMode);
    }
}
