package features.world.dungeonmap.ui.workspace;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonCorridorEndpoint;
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
    private DungeonLayout layout;
    private DungeonLayoutRenderData renderData;
    private DungeonCanvasBounds bounds = DungeonCanvasBounds.defaultBounds();
    private DungeonSelection selectedTarget;
    private DungeonRuntimeLocation activeLocation;
    private DungeonEditorTool editorTool = DungeonEditorTool.SELECT;

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
        workspacePane.widthProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        workspacePane.heightProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        applyViewMode();
    }

    public void showLayout(DungeonLayout layout, DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation) {
        boolean resetView = shouldResetView(layout);
        this.layout = layout;
        this.renderData = DungeonLayoutRenderData.from(layout);
        this.bounds = DungeonCanvasBounds.forLayout(layout);
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        gridPane.showLayout(layout, renderData, selectedTarget, activeLocation, false);
        graphPane.showLayout(layout, renderData, selectedTarget, activeLocation, false);
        refreshViewport(resetView);
    }

    public void updateSelection(DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation) {
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        gridPane.updateSelection(selectedTarget, activeLocation, viewMode == DungeonViewMode.GRID);
        graphPane.updateSelection(selectedTarget, activeLocation, viewMode == DungeonViewMode.GRAPH);
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

    public void setOnClusterWallPainted(Consumer<Set<DungeonClusterEdgeRef>> onClusterWallPainted) {
        gridPane.setOnClusterWallPainted(onClusterWallPainted);
    }

    public void setOnClusterDoorPainted(Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorPainted) {
        gridPane.setOnClusterDoorPainted(onClusterDoorPainted);
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

    public void setOnCorridorDoorSelected(Consumer<CorridorEditInteractionController.DoorHandle> onCorridorDoorSelected) {
        gridPane.setOnCorridorDoorSelected(onCorridorDoorSelected);
        graphPane.setOnCorridorDoorSelected(onCorridorDoorSelected);
    }

    public void setOnCorridorDoorMoved(
            BiConsumer<CorridorEditInteractionController.DoorHandle, CorridorEditInteractionController.DoorMoveTarget> onCorridorDoorMoved
    ) {
        gridPane.setOnCorridorDoorMoved(onCorridorDoorMoved);
        graphPane.setOnCorridorDoorMoved(onCorridorDoorMoved);
    }

    public void setOnCorridorWaypointSelected(Consumer<CorridorEditInteractionController.WaypointHandle> onCorridorWaypointSelected) {
        gridPane.setOnCorridorWaypointSelected(onCorridorWaypointSelected);
        graphPane.setOnCorridorWaypointSelected(onCorridorWaypointSelected);
    }

    public void setOnCorridorWaypointAdded(Consumer<CorridorEditInteractionController.SegmentInsertHit> onCorridorWaypointAdded) {
        gridPane.setOnCorridorWaypointAdded(onCorridorWaypointAdded);
        graphPane.setOnCorridorWaypointAdded(onCorridorWaypointAdded);
    }

    public void setOnCorridorWaypointMoved(
            BiConsumer<CorridorEditInteractionController.WaypointHandle, Point2i> onCorridorWaypointMoved
    ) {
        gridPane.setOnCorridorWaypointMoved(onCorridorWaypointMoved);
        graphPane.setOnCorridorWaypointMoved(onCorridorWaypointMoved);
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        this.editorTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        gridPane.setEditorTool(this.editorTool);
        graphPane.setEditorTool(this.editorTool);
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
