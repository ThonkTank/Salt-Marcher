package features.world.dungeonmap.ui.workspace;

import features.world.dungeonmap.model.CorridorComponent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.model.DungeonClusterVertexRef;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.workspace.render.DungeonCanvasBounds;
import features.world.dungeonmap.ui.workspace.render.DungeonCanvasCamera;
import features.world.dungeonmap.ui.workspace.render.CorridorDoorHit;
import features.world.dungeonmap.ui.workspace.render.CorridorEditInteractionController;
import features.world.dungeonmap.ui.workspace.render.DungeonGraphPane;
import features.world.dungeonmap.ui.workspace.render.DungeonGridPane;
import features.world.dungeonmap.ui.workspace.render.DungeonLayoutRenderData;
import features.world.dungeonmap.ui.workspace.render.DungeonWorkspaceRenderState;
import features.world.dungeonmap.ui.workspace.render.WallPathInteractionController;
import javafx.geometry.Point2D;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;

import java.util.Objects;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonSplitWorkspace extends BorderPane {

    private final DungeonCanvasCamera camera = new DungeonCanvasCamera(32);
    private final DungeonGridPane gridPane = new DungeonGridPane(camera);
    private final DungeonGraphPane graphPane = new DungeonGraphPane(camera);
    private final StackPane workspacePane = new StackPane(gridPane, graphPane);
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private DungeonWorkspaceRenderState renderState;
    private DungeonLayout layout;
    private DungeonCanvasBounds bounds = DungeonCanvasBounds.defaultBounds();
    private DungeonSelection selectedTarget;
    private DungeonRuntimeLocation activeLocation;
    private DungeonEditorTool editorTool = DungeonEditorTool.SELECT;
    private DungeonCorridorDoorHandle selectedCorridorDoorHandle;
    private Consumer<DungeonCorridorDoorHandle> onCorridorDoorSelectionChanged = handle -> { };
    private boolean syncingCorridorDoorSelection;

    public DungeonSplitWorkspace(boolean editable) {
        setCenter(workspacePane);
        gridPane.setEditable(editable);
        graphPane.setEditable(editable);
        gridPane.setOnViewportPanStarted(this::beginPan);
        graphPane.setOnViewportPanStarted(this::beginPan);
        gridPane.setOnViewportPanned(this::updatePan);
        graphPane.setOnViewportPanned(this::updatePan);
        gridPane.setOnViewportZoomed(this::zoomAt);
        graphPane.setOnViewportZoomed(this::zoomAt);
        gridPane.setOnCorridorDoorSelectionChanged(handle -> syncCorridorDoorSelection(handle, gridPane));
        graphPane.setOnCorridorDoorSelectionChanged(handle -> syncCorridorDoorSelection(handle, graphPane));
        workspacePane.widthProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        workspacePane.heightProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        applyViewMode();
    }

    public void showLayout(DungeonLayout layout, DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation) {
        boolean resetView = shouldResetView(layout);
        this.renderState = DungeonWorkspaceRenderState.from(layout, renderState);
        this.layout = layout;
        DungeonLayoutRenderData renderData = renderState == null ? null : this.renderState.renderData();
        this.bounds = renderState == null ? DungeonCanvasBounds.defaultBounds() : this.renderState.bounds();
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        gridPane.showLayout(layout, renderData, selectedTarget, activeLocation, false);
        graphPane.showLayout(layout, renderData, selectedTarget, activeLocation, false);
        setSelectedCorridorDoorHandle(selectedCorridorDoorHandle);
        refreshViewport(resetView);
    }

    public void updateSelection(DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation) {
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        gridPane.updateSelection(selectedTarget, activeLocation, viewMode == DungeonViewMode.GRID);
        graphPane.updateSelection(selectedTarget, activeLocation, viewMode == DungeonViewMode.GRAPH);
        setSelectedCorridorDoorHandle(selectedCorridorDoorHandle);
    }

    public void setViewMode(DungeonViewMode viewMode) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (this.viewMode == nextViewMode) {
            return;
        }
        this.viewMode = nextViewMode;
        applyViewMode();
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        gridPane.setOnRoomSelected(onRoomSelected);
        graphPane.setOnRoomSelected(onRoomSelected);
    }

    public void setOnClusterSelected(Consumer<DungeonRoomCluster> onClusterSelected) {
        gridPane.setOnClusterSelected(onClusterSelected);
        graphPane.setOnClusterSelected(onClusterSelected);
    }

    public void setOnCorridorSelected(Consumer<DungeonCorridor> onCorridorSelected) {
        gridPane.setOnCorridorSelected(onCorridorSelected);
        graphPane.setOnCorridorSelected(onCorridorSelected);
    }

    public void setOnRoomMoved(BiConsumer<DungeonRoom, Point2i> onRoomMoved) {
        gridPane.setOnRoomMoved(onRoomMoved);
        graphPane.setOnRoomMoved(onRoomMoved);
    }

    public void setOnClusterMoved(BiConsumer<DungeonRoomCluster, Point2i> onClusterMoved) {
        gridPane.setOnClusterMoved(onClusterMoved);
        graphPane.setOnClusterMoved(onClusterMoved);
    }

    public void setOnCorridorEndpointSelected(Consumer<DungeonCorridorEndpoint> onCorridorEndpointSelected) {
        gridPane.setOnCorridorEndpointSelected(onCorridorEndpointSelected);
        graphPane.setOnCorridorEndpointSelected(onCorridorEndpointSelected);
    }

    public void setOnRoomCellsPainted(Consumer<Set<Point2i>> onRoomCellsPainted) {
        gridPane.setOnRoomCellsPainted(onRoomCellsPainted);
    }

    public void setOnRoomCellsDeleted(Consumer<Set<Point2i>> onRoomCellsDeleted) {
        gridPane.setOnRoomCellsDeleted(onRoomCellsDeleted);
    }

    public void setOnClusterDoorPainted(Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorPainted) {
        gridPane.setOnClusterDoorPainted(onClusterDoorPainted);
    }

    public void setOnClusterDoorDeleted(Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorDeleted) {
        gridPane.setOnClusterDoorDeleted(onClusterDoorDeleted);
    }

    public CorridorComponent corridorComponentFor(long corridorId) {
        if (renderState == null || renderState.renderData() == null) {
            return null;
        }
        return renderState.renderData().corridorTopology().componentForCorridor(corridorId);
    }

    public CorridorComponent corridorComponentById(String componentId) {
        if (renderState == null || renderState.renderData() == null) {
            return null;
        }
        return renderState.renderData().corridorTopology().componentById(componentId);
    }

    public void setOnGraphRoomRequested(Consumer<Point2i> onGraphRoomRequested) {
        graphPane.setOnGraphRoomRequested(onGraphRoomRequested);
    }

    public void setOnGraphRoomDeleted(Consumer<DungeonRoom> onGraphRoomDeleted) {
        graphPane.setOnGraphRoomDeleted(onGraphRoomDeleted);
    }

    public void setOnGraphClusterDeleted(Consumer<DungeonRoomCluster> onGraphClusterDeleted) {
        graphPane.setOnGraphClusterDeleted(onGraphClusterDeleted);
    }

    public void setOnCorridorDeleted(Consumer<DungeonCorridor> onCorridorDeleted) {
        gridPane.setOnCorridorDeleted(onCorridorDeleted);
        graphPane.setOnCorridorDeleted(onCorridorDeleted);
    }

    public void setOnCorridorRoomRemoved(Consumer<CorridorDoorHit> onCorridorRoomRemoved) {
        gridPane.setOnCorridorRoomRemoved(onCorridorRoomRemoved);
        graphPane.setOnCorridorRoomRemoved(onCorridorRoomRemoved);
    }

    public void setOnWallPathStateChanged(Runnable onWallPathStateChanged) {
        gridPane.wallPathController().setOnStateChanged(onWallPathStateChanged);
    }

    public void setOnWallPathCommitRequested(Consumer<DungeonWallPathCommit> onWallPathCommitRequested) {
        Consumer<DungeonWallPathCommit> consumer = onWallPathCommitRequested == null ? request -> { } : onWallPathCommitRequested;
        gridPane.wallPathController().setOnCommitRequested(request ->
                consumer.accept(new DungeonWallPathCommit(request.edgeRefs(), request.nextAnchor())));
    }

    public void cancelWallPath() {
        gridPane.wallPathController().cancel();
    }

    public void applyWallPathCommitResult(DungeonClusterVertexRef nextAnchor) {
        gridPane.wallPathController().applyCommitResult(nextAnchor);
    }

    public void revertPendingWallPathCommit() {
        gridPane.wallPathController().revertPendingCommit();
    }

    public DungeonWallPathState snapshotWallPathState() {
        WallPathInteractionController.StateSnapshot snapshot = gridPane.wallPathController().snapshotState();
        return snapshot == null
                ? null
                : new DungeonWallPathState(
                        snapshot.activeAnchor(),
                        snapshot.previewPath(),
                        snapshot.commitPending(),
                        snapshot.pendingAnchor());
    }

    public void restoreWallPathState(DungeonWallPathState state) {
        if (state == null) {
            gridPane.wallPathController().restoreState(null);
            return;
        }
        gridPane.wallPathController().restoreState(new WallPathInteractionController.StateSnapshot(
                state.activeAnchor(),
                state.previewPath(),
                state.commitPending(),
                state.pendingAnchor()));
    }

    public DungeonClusterVertexRef displayedWallAnchor() {
        return gridPane.wallPathController().displayedAnchor();
    }

    public void setOnCorridorDoorSelected(Consumer<DungeonCorridorDoorHandle> onCorridorDoorSelected) {
        Consumer<DungeonCorridorDoorHandle> consumer = onCorridorDoorSelected == null ? handle -> { } : onCorridorDoorSelected;
        gridPane.setOnCorridorDoorSelected(handle -> consumer.accept(toWorkspaceHandle(handle)));
        graphPane.setOnCorridorDoorSelected(handle -> consumer.accept(toWorkspaceHandle(handle)));
    }

    public void setOnCorridorDoorSelectionChanged(Consumer<DungeonCorridorDoorHandle> onCorridorDoorSelectionChanged) {
        this.onCorridorDoorSelectionChanged = onCorridorDoorSelectionChanged == null ? handle -> { } : onCorridorDoorSelectionChanged;
    }

    public DungeonCorridorDoorHandle selectedCorridorDoorHandle() {
        return selectedCorridorDoorHandle;
    }

    public void setSelectedCorridorDoorHandle(DungeonCorridorDoorHandle handle) {
        syncCorridorDoorSelection(toRenderHandle(handle), null);
    }

    public void setOnCorridorDoorMoved(
            BiConsumer<DungeonCorridorDoorHandle, DungeonCorridorDoorMoveTarget> onCorridorDoorMoved
    ) {
        BiConsumer<DungeonCorridorDoorHandle, DungeonCorridorDoorMoveTarget> consumer = onCorridorDoorMoved == null
                ? (handle, target) -> { }
                : onCorridorDoorMoved;
        gridPane.setOnCorridorDoorMoved((handle, target) ->
                consumer.accept(toWorkspaceHandle(handle), toWorkspaceMoveTarget(target)));
        graphPane.setOnCorridorDoorMoved((handle, target) ->
                consumer.accept(toWorkspaceHandle(handle), toWorkspaceMoveTarget(target)));
    }

    public void setOnCorridorWaypointSelected(Consumer<DungeonCorridorWaypointHandle> onCorridorWaypointSelected) {
        Consumer<DungeonCorridorWaypointHandle> consumer = onCorridorWaypointSelected == null ? handle -> { } : onCorridorWaypointSelected;
        gridPane.setOnCorridorWaypointSelected(handle -> consumer.accept(toWorkspaceHandle(handle)));
        graphPane.setOnCorridorWaypointSelected(handle -> consumer.accept(toWorkspaceHandle(handle)));
    }

    public void setOnCorridorWaypointAdded(Consumer<DungeonCorridorWaypointInsert> onCorridorWaypointAdded) {
        Consumer<DungeonCorridorWaypointInsert> consumer = onCorridorWaypointAdded == null ? hit -> { } : onCorridorWaypointAdded;
        gridPane.setOnCorridorWaypointAdded(hit -> consumer.accept(toWorkspaceInsert(hit)));
        graphPane.setOnCorridorWaypointAdded(hit -> consumer.accept(toWorkspaceInsert(hit)));
    }

    public void setOnCorridorWaypointRemoved(Consumer<DungeonCorridorWaypointHandle> onCorridorWaypointRemoved) {
        Consumer<DungeonCorridorWaypointHandle> consumer = onCorridorWaypointRemoved == null ? handle -> { } : onCorridorWaypointRemoved;
        gridPane.setOnCorridorWaypointRemoved(handle -> consumer.accept(toWorkspaceHandle(handle)));
        graphPane.setOnCorridorWaypointRemoved(handle -> consumer.accept(toWorkspaceHandle(handle)));
    }

    public void setOnCorridorWaypointMoved(
            BiConsumer<DungeonCorridorWaypointHandle, Point2i> onCorridorWaypointMoved
    ) {
        BiConsumer<DungeonCorridorWaypointHandle, Point2i> consumer = onCorridorWaypointMoved == null
                ? (handle, cell) -> { }
                : onCorridorWaypointMoved;
        gridPane.setOnCorridorWaypointMoved((handle, cell) -> consumer.accept(toWorkspaceHandle(handle), cell));
        graphPane.setOnCorridorWaypointMoved((handle, cell) -> consumer.accept(toWorkspaceHandle(handle), cell));
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        this.editorTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        gridPane.setEditorTool(this.editorTool);
        graphPane.setEditorTool(this.editorTool);
        setSelectedCorridorDoorHandle(selectedCorridorDoorHandle);
    }

    private void applyViewMode() {
        // Grid and graph are two projections of the same room anchor coordinates.
        // They must never drift into separate positioning states.
        boolean showGrid = viewMode == DungeonViewMode.GRID;
        gridPane.setVisible(showGrid);
        gridPane.setManaged(showGrid);
        graphPane.setVisible(!showGrid);
        graphPane.setManaged(!showGrid);
        if (showGrid) {
            gridPane.toFront();
            gridPane.updateSelection(selectedTarget, activeLocation, true);
        } else {
            graphPane.toFront();
            graphPane.updateSelection(selectedTarget, activeLocation, true);
        }
        setEditorTool(editorTool);
    }

    private void beginPan(Point2D point) {
        camera.beginPan(point.getX(), point.getY());
    }

    private void updatePan(Point2D point) {
        camera.updatePan(point.getX(), point.getY());
        refreshPanes();
    }

    private void zoomAt(double screenX, double screenY, double factor) {
        camera.zoomAt(screenX, screenY, factor);
        refreshPanes();
    }

    private void refreshViewport(boolean resetView) {
        camera.showBounds(bounds, Math.max(160, workspacePane.getWidth()), Math.max(160, workspacePane.getHeight()), resetView);
        refreshPanes();
    }

    private void refreshPanes() {
        if (viewMode == DungeonViewMode.GRID) {
            gridPane.refreshViewport();
        } else {
            graphPane.refreshViewport();
        }
    }

    private void syncCorridorDoorSelection(
            CorridorEditInteractionController.DoorHandle handle,
            Object source
    ) {
        if (syncingCorridorDoorSelection) {
            return;
        }
        syncingCorridorDoorSelection = true;
        try {
            if (source != gridPane) {
                gridPane.setSelectedCorridorDoorHandle(handle);
            }
            if (source != graphPane) {
                graphPane.setSelectedCorridorDoorHandle(handle);
            }
            CorridorEditInteractionController.DoorHandle normalized = source == gridPane
                    ? gridPane.selectedCorridorDoorHandle()
                    : source == graphPane ? graphPane.selectedCorridorDoorHandle() : gridPane.selectedCorridorDoorHandle();
            DungeonCorridorDoorHandle normalizedHandle = toWorkspaceHandle(normalized);
            if (!Objects.equals(selectedCorridorDoorHandle, normalizedHandle)) {
                selectedCorridorDoorHandle = normalizedHandle;
                onCorridorDoorSelectionChanged.accept(selectedCorridorDoorHandle);
                return;
            }
            selectedCorridorDoorHandle = normalizedHandle;
        } finally {
            syncingCorridorDoorSelection = false;
        }
    }

    private static DungeonCorridorDoorHandle toWorkspaceHandle(CorridorEditInteractionController.DoorHandle handle) {
        return handle == null ? null : new DungeonCorridorDoorHandle(handle.corridorId(), handle.roomId());
    }

    private static CorridorEditInteractionController.DoorHandle toRenderHandle(DungeonCorridorDoorHandle handle) {
        return handle == null ? null : new CorridorEditInteractionController.DoorHandle(handle.corridorId(), handle.roomId());
    }

    private static DungeonCorridorDoorMoveTarget toWorkspaceMoveTarget(CorridorEditInteractionController.DoorMoveTarget target) {
        return target == null ? null : new DungeonCorridorDoorMoveTarget(target.roomId(), target.roomCell(), target.direction());
    }

    private static DungeonCorridorWaypointHandle toWorkspaceHandle(CorridorEditInteractionController.WaypointHandle handle) {
        return handle == null ? null : new DungeonCorridorWaypointHandle(handle.corridorId(), handle.waypointIndex());
    }

    private static DungeonCorridorWaypointInsert toWorkspaceInsert(CorridorEditInteractionController.SegmentInsertHit hit) {
        return hit == null ? null : new DungeonCorridorWaypointInsert(hit.corridorId(), hit.insertIndex(), hit.cell());
    }

    private boolean shouldResetView(DungeonLayout nextLayout) {
        if (layout == null || layout.map() == null) {
            return nextLayout != null;
        }
        if (nextLayout == null || nextLayout.map() == null) {
            return true;
        }
        return !Objects.equals(layout.map().mapId(), nextLayout.map().mapId());
    }
}
