package features.world.dungeonmap.ui.workspace.workflow;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.workspace.render.CorridorDoorHit;
import features.world.dungeonmap.ui.workspace.render.DungeonViewportZoomHandler;
import javafx.geometry.Point2D;

import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonPaneCallbacks {
    private Consumer<DungeonRoom> onRoomSelected = room -> { };
    private Consumer<DungeonRoomCluster> onClusterSelected = cluster -> { };
    private Consumer<DungeonCorridor> onCorridorSelected = corridor -> { };
    private Consumer<CorridorEditInteractionController.DoorHandle> onCorridorDoorSelectionChanged = handle -> { };
    private BiConsumer<DungeonRoom, Point2i> onRoomMoved = (room, center) -> { };
    private BiConsumer<DungeonRoomCluster, Point2i> onClusterMoved = (cluster, center) -> { };
    private Consumer<DungeonCorridorEndpoint> onCorridorEndpointSelected = location -> { };
    private Consumer<Set<Point2i>> onRoomCellsPainted = cells -> { };
    private Consumer<Set<Point2i>> onRoomCellsDeleted = cells -> { };
    private Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorPainted = refs -> { };
    private Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorDeleted = refs -> { };
    private Consumer<Point2i> onGraphRoomRequested = point -> { };
    private Consumer<DungeonRoom> onGraphRoomDeleted = room -> { };
    private Consumer<DungeonRoomCluster> onGraphClusterDeleted = cluster -> { };
    private Consumer<DungeonCorridor> onCorridorDeleted = corridor -> { };
    private Consumer<CorridorDoorHit> onCorridorRoomRemoved = hit -> { };
    private Consumer<Point2D> onViewportPanStarted = point -> { };
    private Consumer<Point2D> onViewportPanned = point -> { };
    private DungeonViewportZoomHandler onViewportZoomed = (screenX, screenY, factor) -> { };

    public Consumer<DungeonRoom> onRoomSelected() {
        return onRoomSelected;
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        this.onRoomSelected = onRoomSelected;
    }

    public Consumer<DungeonRoomCluster> onClusterSelected() {
        return onClusterSelected;
    }

    public void setOnClusterSelected(Consumer<DungeonRoomCluster> onClusterSelected) {
        this.onClusterSelected = onClusterSelected;
    }

    public Consumer<DungeonCorridor> onCorridorSelected() {
        return onCorridorSelected;
    }

    public void setOnCorridorSelected(Consumer<DungeonCorridor> onCorridorSelected) {
        this.onCorridorSelected = onCorridorSelected;
    }

    public Consumer<CorridorEditInteractionController.DoorHandle> onCorridorDoorSelectionChanged() {
        return onCorridorDoorSelectionChanged;
    }

    public void setOnCorridorDoorSelectionChanged(Consumer<CorridorEditInteractionController.DoorHandle> onCorridorDoorSelectionChanged) {
        this.onCorridorDoorSelectionChanged = onCorridorDoorSelectionChanged;
    }

    public BiConsumer<DungeonRoom, Point2i> onRoomMoved() {
        return onRoomMoved;
    }

    public void setOnRoomMoved(BiConsumer<DungeonRoom, Point2i> onRoomMoved) {
        this.onRoomMoved = onRoomMoved;
    }

    public BiConsumer<DungeonRoomCluster, Point2i> onClusterMoved() {
        return onClusterMoved;
    }

    public void setOnClusterMoved(BiConsumer<DungeonRoomCluster, Point2i> onClusterMoved) {
        this.onClusterMoved = onClusterMoved;
    }

    public Consumer<DungeonCorridorEndpoint> onCorridorEndpointSelected() {
        return onCorridorEndpointSelected;
    }

    public void setOnCorridorEndpointSelected(Consumer<DungeonCorridorEndpoint> onCorridorEndpointSelected) {
        this.onCorridorEndpointSelected = onCorridorEndpointSelected;
    }

    public Consumer<Set<Point2i>> onRoomCellsPainted() {
        return onRoomCellsPainted;
    }

    public void setOnRoomCellsPainted(Consumer<Set<Point2i>> onRoomCellsPainted) {
        this.onRoomCellsPainted = onRoomCellsPainted;
    }

    public Consumer<Set<Point2i>> onRoomCellsDeleted() {
        return onRoomCellsDeleted;
    }

    public void setOnRoomCellsDeleted(Consumer<Set<Point2i>> onRoomCellsDeleted) {
        this.onRoomCellsDeleted = onRoomCellsDeleted;
    }

    public Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorPainted() {
        return onClusterDoorPainted;
    }

    public void setOnClusterDoorPainted(Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorPainted) {
        this.onClusterDoorPainted = onClusterDoorPainted;
    }

    public Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorDeleted() {
        return onClusterDoorDeleted;
    }

    public void setOnClusterDoorDeleted(Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorDeleted) {
        this.onClusterDoorDeleted = onClusterDoorDeleted;
    }

    public Consumer<Point2i> onGraphRoomRequested() {
        return onGraphRoomRequested;
    }

    public void setOnGraphRoomRequested(Consumer<Point2i> onGraphRoomRequested) {
        this.onGraphRoomRequested = onGraphRoomRequested;
    }

    public Consumer<DungeonRoom> onGraphRoomDeleted() {
        return onGraphRoomDeleted;
    }

    public void setOnGraphRoomDeleted(Consumer<DungeonRoom> onGraphRoomDeleted) {
        this.onGraphRoomDeleted = onGraphRoomDeleted;
    }

    public Consumer<DungeonRoomCluster> onGraphClusterDeleted() {
        return onGraphClusterDeleted;
    }

    public void setOnGraphClusterDeleted(Consumer<DungeonRoomCluster> onGraphClusterDeleted) {
        this.onGraphClusterDeleted = onGraphClusterDeleted;
    }

    public Consumer<DungeonCorridor> onCorridorDeleted() {
        return onCorridorDeleted;
    }

    public void setOnCorridorDeleted(Consumer<DungeonCorridor> onCorridorDeleted) {
        this.onCorridorDeleted = onCorridorDeleted;
    }

    public Consumer<CorridorDoorHit> onCorridorRoomRemoved() {
        return onCorridorRoomRemoved;
    }

    public void setOnCorridorRoomRemoved(Consumer<CorridorDoorHit> onCorridorRoomRemoved) {
        this.onCorridorRoomRemoved = onCorridorRoomRemoved;
    }

    public Consumer<Point2D> onViewportPanStarted() {
        return onViewportPanStarted;
    }

    public void setOnViewportPanStarted(Consumer<Point2D> onViewportPanStarted) {
        this.onViewportPanStarted = onViewportPanStarted;
    }

    public Consumer<Point2D> onViewportPanned() {
        return onViewportPanned;
    }

    public void setOnViewportPanned(Consumer<Point2D> onViewportPanned) {
        this.onViewportPanned = onViewportPanned;
    }

    public DungeonViewportZoomHandler onViewportZoomed() {
        return onViewportZoomed;
    }

    public void setOnViewportZoomed(DungeonViewportZoomHandler onViewportZoomed) {
        this.onViewportZoomed = onViewportZoomed;
    }
}
