package features.world.quarantine.dungeonmap.editor.workspace;

import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditCommand;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonEditorWorkspaceSink;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonPaneInteractionSink;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneEventTranslator;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorEditInteractionController;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonWallPathCommit;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonWallPathSessionState;
import features.world.quarantine.dungeonmap.editor.workspace.graph.DungeonGraphPane;
import features.world.quarantine.dungeonmap.editor.workspace.grid.DungeonGridPane;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorTopology;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorTopologyPlanner;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.canvas.state.DungeonViewState;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasBounds;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonViewportController;
import features.world.quarantine.dungeonmap.canvas.state.DungeonWorkspaceRenderState;
import features.world.quarantine.dungeonmap.editor.session.EditorWorkspacePort;
import javafx.geometry.Point2D;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;

import java.util.Objects;
import java.util.Set;

public final class DungeonEditorSplitWorkspace extends BorderPane implements EditorWorkspacePort {

    private final DungeonViewportController host = new DungeonViewportController(32);
    private final DungeonGridPane gridPane;
    private final DungeonPaneInteractionSink graphPaneSink;
    private final DungeonEditorPaneGroup panes;
    private final StackPane panesContainer;
    private final DungeonWallPathSessionState wallPathState;

    private DungeonEditorWorkspaceSink sink = DungeonEditorWorkspaceSink.NO_OP;
    private CorridorDoorHandle selectedCorridorDoorHandle;

    private DungeonWorkspaceRenderState renderState;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private DungeonEditorTool editorTool = DungeonEditorTool.SELECT;

    public DungeonEditorSplitWorkspace() {
        DungeonPaneInteractionSink gridPaneSink = new DungeonPaneEventTranslator(
                this::workspaceSink, this::applyAndNotifyCorridorDoor, this::beginPan, this::updatePan, this::zoomAt);
        this.graphPaneSink = new DungeonPaneEventTranslator(
                this::workspaceSink, this::applyAndNotifyCorridorDoor, this::beginPan, this::updatePan, this::zoomAt);
        this.gridPane = new DungeonGridPane(host.camera(), gridPaneSink);
        this.wallPathState = gridPane.wallPathState();
        this.panes = new DungeonEditorPaneGroup(gridPane);
        this.panesContainer = new StackPane(gridPane);
        setCenter(panesContainer);
        panes.setEditable(true);
        installWallPathCallbacks(this.sink);
        panesContainer.widthProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        panesContainer.heightProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        applyViewMode(DungeonViewMode.GRID, DungeonEditorTool.SELECT);
    }

    public void showLayout(DungeonViewState viewState, DungeonViewMode viewMode, DungeonEditorTool editorTool) {
        DungeonLayout nextLayout = viewState == null ? null : viewState.layout();
        boolean resetView = host.shouldResetView(nextLayout);
        CorridorTopology corridorTopology = nextLayout != null ? CorridorTopologyPlanner.planCorridorTopology(nextLayout) : null;
        this.renderState = DungeonWorkspaceRenderState.from(nextLayout, corridorTopology, renderState);
        applyRenderState(viewState, viewMode, editorTool, resetView);
    }

    public void showPreparedLayout(
            DungeonViewState viewState,
            DungeonWorkspaceRenderState renderState,
            DungeonViewMode viewMode,
            DungeonEditorTool editorTool
    ) {
        DungeonLayout nextLayout = viewState == null ? null : viewState.layout();
        boolean resetView = host.shouldResetView(nextLayout);
        this.renderState = renderState;
        applyRenderState(viewState, viewMode, editorTool, resetView);
    }

    public void setEditable(boolean editable) {
        panes.setEditable(editable);
    }

    public void updateSelection(DungeonViewState viewState, DungeonViewMode viewMode) {
        panes.updateSelection(viewState, viewMode);
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle);
    }

    public void setInteractionSinks(DungeonEditorWorkspaceSink sink) {
        this.sink = sink == null ? DungeonEditorWorkspaceSink.NO_OP : sink;
        installWallPathCallbacks(this.sink);
    }

    private DungeonEditorWorkspaceSink workspaceSink() {
        return sink;
    }

    public void setViewMode(DungeonViewMode viewMode, DungeonEditorTool editorTool) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        applyViewMode(nextViewMode, editorTool);
    }

    public DungeonWallPathSessionState wallPathState() {
        return wallPathState;
    }

    public void setSelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        applySelectedCorridorDoorHandle(handle);
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        DungeonEditorTool nextTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        if (this.editorTool == nextTool) {
            return;
        }
        this.editorTool = nextTool;
        panes.setEditorTool(nextTool);
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle);
    }

    private void applyViewMode(DungeonViewMode viewMode, DungeonEditorTool editorTool) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        DungeonEditorTool nextTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        if (nextViewMode == DungeonViewMode.GRAPH) {
            ensureGraphPane();
        }
        boolean viewModeChanged = this.viewMode != nextViewMode;
        boolean toolChanged = this.editorTool != nextTool;
        this.viewMode = nextViewMode;
        this.editorTool = nextTool;
        panes.setVisibleViewMode(nextViewMode);
        if (viewModeChanged) {
            panes.refreshActiveViewport();
        }
        if (toolChanged || viewModeChanged) {
            panes.setEditorTool(nextTool);
        }
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle);
    }

    private void applySelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        panes.setSelectedCorridorDoorHandle(handle);
        selectedCorridorDoorHandle = panes.selectedCorridorDoorHandle();
    }

    private void applyAndNotifyCorridorDoor(CorridorDoorHandle handle) {
        applySelectedCorridorDoorHandle(handle);
        sink.onCorridorDoorSelectionChanged(selectedCorridorDoorHandle);
    }

    private void installWallPathCallbacks(DungeonEditorWorkspaceSink sink) {
        wallPathState.setOnWallPathStateChanged(sink::onWallPathStateChanged);
        wallPathState.setOnWallPathCommitRequested((edgeRefs, nextAnchor) ->
                sink.onWallPathCommitRequested(
                        new DungeonWallPathCommit(edgeRefs, nextAnchor),
                        gridPane.activeEditorTool() == DungeonEditorTool.CLUSTER_WALL_DELETE));
    }

    private void ensureGraphPane() {
        if (panes.active(DungeonViewMode.GRAPH) != gridPane) {
            return;
        }
        DungeonGraphPane graphPane = new DungeonGraphPane(host.camera(), graphPaneSink);
        panes.attachGraphPane(graphPane);
        panesContainer.getChildren().add(graphPane);
        graphPane.setVisible(false);
        graphPane.setManaged(false);
    }

    private void beginPan(Point2D point) {
        host.beginPan(point);
    }

    private void updatePan(Point2D point) {
        host.updatePan(point, this::refreshPanes);
    }

    private void zoomAt(double screenX, double screenY, double factor) {
        host.zoomAt(screenX, screenY, factor, this::refreshPanes);
    }

    private void refreshViewport(boolean resetView) {
        host.refreshViewport(panesContainer.getWidth(), panesContainer.getHeight(), resetView, this::refreshPanes);
    }

    private void refreshPanes() {
        panes.refreshActiveViewport();
    }

    private void applyRenderState(
            DungeonViewState viewState,
            DungeonViewMode viewMode,
            DungeonEditorTool editorTool,
            boolean resetView
    ) {
        DungeonLayout nextLayout = viewState == null ? null : viewState.layout();
        DungeonLayoutRenderData renderData = renderState == null ? null : renderState.renderData();
        DungeonCanvasBounds bounds = renderState == null ? DungeonCanvasBounds.defaultBounds() : renderState.bounds();
        host.updateState(nextLayout, bounds);
        panes.showLayout(viewState, renderData);
        applyViewMode(viewMode, editorTool);
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle);
        refreshViewport(resetView);
    }
}
