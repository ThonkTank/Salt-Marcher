package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.domain.model.CorridorGeometry;
import features.world.dungeonmap.domain.model.DungeonLayout;
import features.world.dungeonmap.domain.model.DungeonCorridor;
import features.world.dungeonmap.domain.model.DungeonCorridorGeometry;
import features.world.dungeonmap.domain.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.domain.model.DungeonClusterVertexRef;
import features.world.dungeonmap.domain.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.domain.model.DungeonSelection;
import features.world.dungeonmap.domain.model.DoorSegment;
import features.world.dungeonmap.domain.model.DungeonRoom;
import features.world.dungeonmap.domain.model.DungeonRoomGeometry;
import features.world.dungeonmap.domain.model.DungeonRoomCluster;
import features.world.dungeonmap.domain.model.DungeonRuntimeLocation;
import features.world.dungeonmap.domain.model.Point2i;
import features.world.dungeonmap.domain.model.RoomShape;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import features.world.dungeonmap.ui.workspace.workflow.CorridorEditInteractionController;
import features.world.dungeonmap.ui.workspace.workflow.DungeonEditorSurface;
import features.world.dungeonmap.ui.workspace.workflow.DungeonPaneCallbacks;
import features.world.dungeonmap.ui.workspace.workflow.DungeonPaneWorkflowCoordinator;
import features.world.dungeonmap.ui.workspace.workflow.DungeonPaneWorkflowHost;
import features.world.dungeonmap.ui.workspace.workflow.DungeonPreviewTopologySession;
import features.world.dungeonmap.ui.workspace.workflow.WallPathInteractionController;
import features.world.dungeonmap.ui.workspace.workflow.state.DungeonPaneInteractionState;
import features.world.dungeonmap.ui.workspace.workflow.state.DungeonPreviewState;
import javafx.geometry.Point2D;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.StackPane;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

abstract class AbstractDungeonPane extends StackPane implements DungeonPaneWorkflowHost {

    protected static final double CORRIDOR_DOOR_PREVIEW_HALF_LENGTH = 0.35;
    private static final Point2i ZERO = new Point2i(0, 0);

    protected final Canvas canvas = new Canvas();
    protected final DungeonCanvasCamera camera;
    protected DungeonLayout layout;
    protected DungeonLayoutRenderData renderData;
    protected DungeonSelection selectedTarget;
    protected DungeonRuntimeLocation activeLocation;
    protected boolean editable;
    protected DungeonEditorTool editorTool = DungeonEditorTool.SELECT;
    protected DungeonCorridorGeometry.LayoutContext corridorLayoutContext;
    private final DungeonPreviewState previewState = new DungeonPreviewState();
    private final DungeonPaneInteractionState interactionState = new DungeonPaneInteractionState();
    private final DungeonPaneCallbacks callbacks = new DungeonPaneCallbacks();
    private final DungeonPreviewTopologySession previewTopologySession = new DungeonPreviewTopologySession();
    private final CorridorEditInteractionController corridorEditController;
    private final WallPathInteractionController wallPathController;
    private final DungeonPaneWorkflowCoordinator workflowCoordinator;

    protected AbstractDungeonPane(DungeonCanvasCamera camera) {
        this.camera = Objects.requireNonNull(camera, "camera");
        this.corridorEditController = new CorridorEditInteractionController(new CorridorEditInteractionController.Host() {
            @Override
            public boolean editable() {
                return AbstractDungeonPane.this.editable;
            }

            @Override
            public DungeonEditorTool editorTool() {
                return AbstractDungeonPane.this.editorTool;
            }

            @Override
            public CorridorEditInteractionController.DoorHandle findCorridorDoorHandleAt(double screenX, double screenY) {
                return AbstractDungeonPane.this.findCorridorDoorHandleAt(screenX, screenY);
            }

            @Override
            public CorridorEditInteractionController.DoorDragPreview corridorDoorDragPreviewAt(
                    double screenX,
                    double screenY,
                    CorridorEditInteractionController.DoorHandle handle
            ) {
                return AbstractDungeonPane.this.corridorDoorDragPreviewAt(screenX, screenY, handle);
            }

            @Override
            public boolean updateCorridorDoorPreview(
                    CorridorEditInteractionController.DoorHandle handle,
                    CorridorEditInteractionController.DoorDragPreview preview
            ) {
                return AbstractDungeonPane.this.updateCorridorDoorPreview(handle, preview);
            }

            @Override
            public boolean clearCorridorDoorPreview() {
                return AbstractDungeonPane.this.clearCorridorDoorPreview();
            }

            @Override
            public CorridorEditInteractionController.WaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY) {
                return AbstractDungeonPane.this.findCorridorWaypointHandleAt(screenX, screenY);
            }

            @Override
            public CorridorEditInteractionController.WaypointHandle findCorridorWaypointRemoveHandleAt(double screenX, double screenY) {
                return AbstractDungeonPane.this.findCorridorWaypointRemoveHandleAt(screenX, screenY);
            }

            @Override
            public CorridorEditInteractionController.SegmentInsertHit findCorridorSegmentInsertHitAt(double screenX, double screenY) {
                return AbstractDungeonPane.this.findCorridorSegmentInsertHitAt(screenX, screenY);
            }
        });
        this.wallPathController = new WallPathInteractionController(new WallPathInteractionController.Host() {
            @Override
            public boolean editable() {
                return AbstractDungeonPane.this.editable;
            }

            @Override
            public DungeonEditorTool editorTool() {
                return AbstractDungeonPane.this.editorTool;
            }

            @Override
            public DungeonEditorSurface surface() {
                return AbstractDungeonPane.this.surface();
            }

            @Override
            public List<DungeonClusterVertexRef> findClusterVerticesNear(double screenX, double screenY) {
                return AbstractDungeonPane.this.findClusterVerticesNear(screenX, screenY);
            }

            @Override
            public DungeonClusterVertexRef findClusterVertexNear(long clusterId, double screenX, double screenY) {
                return AbstractDungeonPane.this.findClusterVertexNear(clusterId, screenX, screenY);
            }

            @Override
            public DungeonRoomCluster clusterById(long clusterId) {
                return AbstractDungeonPane.this.layout == null ? null : AbstractDungeonPane.this.layout.clusterById(clusterId);
            }

            @Override
            public Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
                return AbstractDungeonPane.this.clusterCellsFor(cluster);
            }

            @Override
            public void render() {
                AbstractDungeonPane.this.render();
            }
        });
        this.workflowCoordinator = new DungeonPaneWorkflowCoordinator(this);
        setFocusTraversable(true);
        getChildren().add(canvas);
        widthProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        heightProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        addEventHandler(KeyEvent.KEY_PRESSED, workflowCoordinator::handleKeyPressed);
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, event -> requestFocus());
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, workflowCoordinator::handleMousePressed);
        canvas.addEventHandler(MouseEvent.MOUSE_MOVED, workflowCoordinator::handleMouseMoved);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, workflowCoordinator::handleMouseDragged);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, workflowCoordinator::handleMouseReleased);
        canvas.addEventHandler(MouseEvent.MOUSE_EXITED, event -> workflowCoordinator.handlePointerExited());
        canvas.addEventHandler(ScrollEvent.SCROLL, workflowCoordinator::handleScroll);
    }

    public final void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        callbacks.setOnRoomSelected(Objects.requireNonNull(onRoomSelected, "onRoomSelected"));
    }

    public final void setOnClusterSelected(Consumer<DungeonRoomCluster> onClusterSelected) {
        callbacks.setOnClusterSelected(Objects.requireNonNull(onClusterSelected, "onClusterSelected"));
    }

    public final void setOnCorridorSelected(Consumer<DungeonCorridor> onCorridorSelected) {
        callbacks.setOnCorridorSelected(Objects.requireNonNull(onCorridorSelected, "onCorridorSelected"));
    }

    public final void setOnRoomMoved(BiConsumer<DungeonRoom, Point2i> onRoomMoved) {
        callbacks.setOnRoomMoved(Objects.requireNonNull(onRoomMoved, "onRoomMoved"));
    }

    public final void setOnClusterMoved(BiConsumer<DungeonRoomCluster, Point2i> onClusterMoved) {
        callbacks.setOnClusterMoved(Objects.requireNonNull(onClusterMoved, "onClusterMoved"));
    }

    public final void setOnCorridorEndpointSelected(Consumer<DungeonCorridorEndpoint> onCorridorEndpointSelected) {
        callbacks.setOnCorridorEndpointSelected(Objects.requireNonNull(onCorridorEndpointSelected, "onCorridorEndpointSelected"));
    }

    public final void setEditable(boolean editable) {
        this.editable = editable;
    }

    public final void setEditorTool(DungeonEditorTool editorTool) {
        workflowCoordinator.setEditorTool(editorTool);
    }

    public final void setOnViewportPanStarted(Consumer<Point2D> onViewportPanStarted) {
        callbacks.setOnViewportPanStarted(Objects.requireNonNull(onViewportPanStarted, "onViewportPanStarted"));
    }

    public final void setOnViewportPanned(Consumer<Point2D> onViewportPanned) {
        callbacks.setOnViewportPanned(Objects.requireNonNull(onViewportPanned, "onViewportPanned"));
    }

    public final void setOnViewportZoomed(DungeonViewportZoomHandler onViewportZoomed) {
        callbacks.setOnViewportZoomed(Objects.requireNonNull(onViewportZoomed, "onViewportZoomed"));
    }

    public final void setOnRoomCellsPainted(Consumer<Set<Point2i>> onRoomCellsPainted) {
        callbacks.setOnRoomCellsPainted(Objects.requireNonNull(onRoomCellsPainted, "onRoomCellsPainted"));
    }

    public final void setOnRoomCellsDeleted(Consumer<Set<Point2i>> onRoomCellsDeleted) {
        callbacks.setOnRoomCellsDeleted(Objects.requireNonNull(onRoomCellsDeleted, "onRoomCellsDeleted"));
    }

    public final void setOnClusterDoorPainted(Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorPainted) {
        callbacks.setOnClusterDoorPainted(Objects.requireNonNull(onClusterDoorPainted, "onClusterDoorPainted"));
    }

    public final void setOnClusterDoorDeleted(Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorDeleted) {
        callbacks.setOnClusterDoorDeleted(Objects.requireNonNull(onClusterDoorDeleted, "onClusterDoorDeleted"));
    }

    public final void setOnGraphRoomRequested(Consumer<Point2i> onGraphRoomRequested) {
        callbacks.setOnGraphRoomRequested(Objects.requireNonNull(onGraphRoomRequested, "onGraphRoomRequested"));
    }

    public final void setOnGraphRoomDeleted(Consumer<DungeonRoom> onGraphRoomDeleted) {
        callbacks.setOnGraphRoomDeleted(Objects.requireNonNull(onGraphRoomDeleted, "onGraphRoomDeleted"));
    }

    public final void setOnGraphClusterDeleted(Consumer<DungeonRoomCluster> onGraphClusterDeleted) {
        callbacks.setOnGraphClusterDeleted(Objects.requireNonNull(onGraphClusterDeleted, "onGraphClusterDeleted"));
    }

    public final void setOnCorridorDeleted(Consumer<DungeonCorridor> onCorridorDeleted) {
        callbacks.setOnCorridorDeleted(Objects.requireNonNull(onCorridorDeleted, "onCorridorDeleted"));
    }

    public final void setOnCorridorRoomRemoved(Consumer<CorridorDoorHit> onCorridorRoomRemoved) {
        callbacks.setOnCorridorRoomRemoved(Objects.requireNonNull(onCorridorRoomRemoved, "onCorridorRoomRemoved"));
    }

    public final void setOnCorridorDoorSelected(Consumer<CorridorEditInteractionController.DoorHandle> onCorridorDoorSelected) {
        corridorEditController.setOnCorridorDoorSelected(Objects.requireNonNull(onCorridorDoorSelected, "onCorridorDoorSelected"));
    }

    public final void setOnCorridorDoorSelectionChanged(Consumer<CorridorEditInteractionController.DoorHandle> onCorridorDoorSelectionChanged) {
        callbacks.setOnCorridorDoorSelectionChanged(Objects.requireNonNull(onCorridorDoorSelectionChanged, "onCorridorDoorSelectionChanged"));
    }

    public final void setOnCorridorDoorMoved(
            BiConsumer<CorridorEditInteractionController.DoorHandle, CorridorEditInteractionController.DoorMoveTarget> onCorridorDoorMoved
    ) {
        corridorEditController.setOnCorridorDoorMoved(onCorridorDoorMoved);
    }

    public final void setOnCorridorWaypointSelected(Consumer<CorridorEditInteractionController.WaypointHandle> onCorridorWaypointSelected) {
        corridorEditController.setOnCorridorWaypointSelected(onCorridorWaypointSelected);
    }

    public final void setOnCorridorWaypointAdded(Consumer<CorridorEditInteractionController.SegmentInsertHit> onCorridorWaypointAdded) {
        corridorEditController.setOnCorridorWaypointAdded(onCorridorWaypointAdded);
    }

    public final void setOnCorridorWaypointRemoved(Consumer<CorridorEditInteractionController.WaypointHandle> onCorridorWaypointRemoved) {
        corridorEditController.setOnCorridorWaypointRemoved(onCorridorWaypointRemoved);
    }

    public final void setOnCorridorWaypointMoved(
            BiConsumer<CorridorEditInteractionController.WaypointHandle, Point2i> onCorridorWaypointMoved
    ) {
        corridorEditController.setOnCorridorWaypointMoved(onCorridorWaypointMoved);
    }

    public final void showLayout(
            DungeonLayout layout,
            DungeonLayoutRenderData renderData,
            DungeonSelection selectedTarget,
            DungeonRuntimeLocation activeLocation,
            boolean renderNow
    ) {
        workflowCoordinator.showLayout(layout, renderData, selectedTarget, activeLocation, renderNow);
    }

    public final void updateSelection(DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation, boolean renderNow) {
        workflowCoordinator.updateSelection(selectedTarget, activeLocation, renderNow);
    }

    public final CorridorEditInteractionController.DoorHandle selectedCorridorDoorHandle() {
        return previewState.selectedCorridorDoorHandle();
    }

    public final void setSelectedCorridorDoorHandle(CorridorEditInteractionController.DoorHandle handle) {
        workflowCoordinator.setSelectedCorridorDoorHandle(handle);
    }

    public final void refreshViewport() {
        workflowCoordinator.refreshViewport();
    }

    protected final WallPathInteractionController wallPathInteractionController() {
        return wallPathController;
    }

    protected final Point2i previewCenter(DungeonRoom room) {
        RoomShape shape = Objects.requireNonNull(layout, "layout").roomShape(room.roomId());
        Point2i center = Objects.requireNonNull(shape, "shape").center();
        return center.add(previewDelta(room.clusterId()));
    }

    protected final Point2i previewCenter(DungeonRoomCluster cluster) {
        Point2i center = Objects.requireNonNull(cluster, "cluster").center();
        return center.add(previewDelta(cluster.clusterId()));
    }

    protected final Point2i previewClusterCell(DungeonRoomCluster cluster, Point2i relativeCell) {
        return previewCenter(cluster).add(relativeCell);
    }

    protected final Point2D previewOffset(Long clusterId) {
        if (clusterId == null) {
            return Point2D.ZERO;
        }
        Point2D offset = previewState.clusterOffsets().get(clusterId);
        return offset == null ? Point2D.ZERO : offset;
    }

    protected final java.util.Map<Long, Point2i> previewClusterCenters() {
        return previewState.clusterCenters();
    }

    protected final Set<Point2i> previewPaintCellsState() {
        return previewState.paintCells();
    }

    protected final Point2i selectionStartCellState() {
        return interactionState.selectionStartCell();
    }

    protected final Point2i selectionEndCellState() {
        return interactionState.selectionEndCell();
    }

    protected final CorridorEditInteractionController.DoorHandle previewCorridorDoorHandle() {
        return previewState.previewCorridorDoorHandle();
    }

    protected final double previewScreenX(double worldX, Long clusterId) {
        return previewScreenX(worldX, previewOffset(clusterId));
    }

    protected final double previewScreenY(double worldY, Long clusterId) {
        return previewScreenY(worldY, previewOffset(clusterId));
    }

    protected final double previewScreenX(double worldX, Point2D offset) {
        return camera.toScreenX(worldX + (offset == null ? 0.0 : offset.getX()));
    }

    protected final double previewScreenY(double worldY, Point2D offset) {
        return camera.toScreenY(worldY + (offset == null ? 0.0 : offset.getY()));
    }

    protected final Point2D corridorPreviewOffset(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || layout == null) {
            return Point2D.ZERO;
        }
        if (hasClusterDragPreview()) {
            // Cluster drag previews already rebuild corridor geometry in the preview session.
            // A second shared offset here would move corridor doors on untouched rooms as well.
            return Point2D.ZERO;
        }
        if (!hasSmoothClusterDragPreview()) {
            return Point2D.ZERO;
        }
        Point2D resolvedOffset = null;
        boolean conflictingOffset = false;
        for (Long roomId : corridor.roomIds()) {
            DungeonRoom room = layout.roomById(roomId);
            Point2D roomOffset = room == null ? Point2D.ZERO : previewOffset(room.clusterId());
            if (!isZeroOffset(roomOffset)) {
                if (resolvedOffset == null || resolvedOffset.equals(roomOffset)) {
                    resolvedOffset = roomOffset;
                } else {
                    conflictingOffset = true;
                }
            }
        }
        for (var waypoint : corridor.waypoints()) {
            Point2D waypointOffset = previewOffset(waypoint.clusterId());
            if (!isZeroOffset(waypointOffset)) {
                if (resolvedOffset == null || resolvedOffset.equals(waypointOffset)) {
                    resolvedOffset = waypointOffset;
                } else {
                    conflictingOffset = true;
                }
            }
        }
        for (var override : corridor.doorOverrides()) {
            Point2D overrideOffset = previewOffset(override.clusterId());
            if (!isZeroOffset(overrideOffset)) {
                if (resolvedOffset == null || resolvedOffset.equals(overrideOffset)) {
                    resolvedOffset = overrideOffset;
                } else {
                    conflictingOffset = true;
                }
            }
        }
        if (conflictingOffset || resolvedOffset == null) {
            return Point2D.ZERO;
        }
        return resolvedOffset;
    }

    protected final Point2D doorPreviewOffset(DoorSegment door) {
        if (door == null || layout == null) {
            return Point2D.ZERO;
        }
        DungeonRoom room = layout.roomById(door.roomId());
        return room == null ? Point2D.ZERO : previewOffset(room.clusterId());
    }

    protected final boolean hasSmoothClusterDragPreview() {
        return previewState.clusterOffsets().values().stream()
                .anyMatch(offset -> offset != null && (!isZero(offset.getX()) || !isZero(offset.getY())));
    }

    protected final boolean isActive(DungeonRoom room) {
        if (room == null || room.roomId() == null || activeLocation == null) {
            return false;
        }
        return activeLocation.matchesRoom(room.roomId());
    }

    protected final boolean isSelected(DungeonRoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null || selectedTarget == null) {
            return false;
        }
        return selectedTarget.selectsRoomCluster(cluster.clusterId());
    }

    protected final boolean isActive(DungeonRoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null || activeLocation == null) {
            return false;
        }
        // Runtime state does not currently expose an active-cluster location.
        // Keep the existing rendering behavior explicit instead of leaving
        // a misleading partially-implemented path in the shared base class.
        return false;
    }

    protected final boolean isSelected(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || selectedTarget == null) {
            return false;
        }
        return selectedTarget.selectsCorridor(corridor.corridorId());
    }

    protected final boolean isHovered(DungeonCorridor corridor) {
        return corridor != null
                && corridor.corridorId() != null
                && Objects.equals(previewState.hoveredCorridorId(), corridor.corridorId());
    }

    protected final boolean isActive(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || activeLocation == null) {
            return false;
        }
        if (activeLocation instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return renderData != null
                    && Objects.equals(corridorComponent.componentId(), renderData.corridorComponentId(corridor.corridorId()));
        }
        return activeLocation.matchesCorridor(corridor.corridorId());
    }

    protected abstract void renderContent(GraphicsContext gc);

    public abstract Point2i worldPointAt(double screenX, double screenY);

    public abstract DungeonRoomCluster findClusterAt(double screenX, double screenY);

    public abstract DungeonRoom findRoomAt(double screenX, double screenY);

    public abstract DungeonCorridor findCorridorAt(double screenX, double screenY);

    public DungeonClusterEdgeRef findClusterEdgeAt(double screenX, double screenY) {
        return null;
    }

    public DungeonClusterVertexRef findClusterVertexAt(double screenX, double screenY) {
        return null;
    }

    public List<DungeonClusterVertexRef> findClusterVerticesNear(double screenX, double screenY) {
        DungeonClusterVertexRef vertex = findClusterVertexAt(screenX, screenY);
        return vertex == null ? List.of() : List.of(vertex);
    }

    public DungeonClusterVertexRef findClusterVertexNear(long clusterId, double screenX, double screenY) {
        for (DungeonClusterVertexRef candidate : findClusterVerticesNear(screenX, screenY)) {
            if (candidate.clusterId() == clusterId) {
                return candidate;
            }
        }
        return null;
    }

    public DungeonCorridorEndpoint corridorEndpointLocationAt(double screenX, double screenY, DungeonRoom room, DungeonCorridor corridor) {
        if (room != null && room.roomId() != null) {
            return DungeonCorridorEndpoint.room(room.roomId());
        }
        if (corridor != null && corridor.corridorId() != null) {
            return DungeonCorridorEndpoint.corridor(corridor.corridorId());
        }
        return null;
    }

    public CorridorDoorHit findCorridorDoorHitAt(double screenX, double screenY) {
        return null;
    }

    protected final CorridorDoorHit corridorDoorHit(DoorSegment door, Long fallbackCorridorId) {
        if (door == null) {
            return null;
        }
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        List<Long> corridorIds = corridorRenderData == null
                ? List.of()
                : corridorRenderData.corridorIdsForDoorFromRoom(door);
        CorridorDoorHit hit = DungeonCorridorDoorHitResolver.resolve(corridorIds, fallbackCorridorId, door.roomId());
        return hit.isEmpty() ? null : hit;
    }

    public CorridorEditInteractionController.DoorHandle findCorridorDoorHandleAt(double screenX, double screenY) {
        return null;
    }

    public CorridorEditInteractionController.DoorDragPreview corridorDoorDragPreviewAt(
            double screenX,
            double screenY,
            CorridorEditInteractionController.DoorHandle handle
    ) {
        return null;
    }

    public CorridorEditInteractionController.WaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY) {
        return null;
    }

    protected int corridorSegmentIndexAt(double screenX, double screenY) {
        return -1;
    }

    public CorridorEditInteractionController.WaypointHandle findCorridorWaypointRemoveHandleAt(double screenX, double screenY) {
        CorridorSelectionContext context = selectedCorridorContext();
        if (context == null || context.geometry().segments().size() <= 1 || context.geometry().waypointCells().isEmpty()) {
            return null;
        }
        int segmentIndex = corridorSegmentIndexAt(screenX, screenY);
        CorridorEditInteractionController.WaypointHandle waypointHandle = findCorridorWaypointHandleAt(screenX, screenY);
        if (waypointHandle != null) {
            return waypointHandle;
        }
        return waypointHandleForSegmentRemoval(context, screenX, screenY, segmentIndex);
    }

    public CorridorEditInteractionController.SegmentInsertHit findCorridorSegmentInsertHitAt(double screenX, double screenY) {
        CorridorSelectionContext context = selectedCorridorContext();
        if (context == null || context.geometry().segments().isEmpty()) {
            return null;
        }
        int segmentIndex = corridorSegmentIndexAt(screenX, screenY);
        if (segmentIndex < 0) {
            return null;
        }
        return new CorridorEditInteractionController.SegmentInsertHit(
                context.corridor().corridorId(),
                insertIndexForSegment(context.corridor().corridorId(), context.geometry(), segmentIndex),
                worldPointAt(screenX, screenY));
    }

    protected CorridorGeometry corridorGeometryForSelection(DungeonCorridor corridor) {
        return corridorGeometryForDisplay(corridor);
    }

    public final CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null) {
            return null;
        }
        CorridorGeometry previewGeometry = previewTopologySession.corridorGeometryOverride(corridor.corridorId());
        if (previewGeometry != null) {
            return previewGeometry;
        }
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        return corridorRenderData == null ? null : corridorRenderData.corridorGeometry(corridor.corridorId());
    }

    protected final DungeonLayoutRenderData corridorRenderDataForDisplay() {
        return renderData;
    }

    protected final CorridorSelectionContext selectedCorridorContext() {
        if (layout == null || renderData == null || !(selectedTarget instanceof DungeonSelection.Corridor selectedCorridor)) {
            return null;
        }
        DungeonCorridor corridor = layout.corridorById(selectedCorridor.corridorId());
        CorridorGeometry geometry = corridorGeometryForSelection(corridor);
        if (corridor == null || geometry == null || !geometry.routable()) {
            return null;
        }
        return new CorridorSelectionContext(corridor, geometry);
    }

    protected final boolean isSelected(CorridorEditInteractionController.DoorHandle handle) {
        return handle != null && handle.equals(previewState.selectedCorridorDoorHandle());
    }

    protected final CorridorEditInteractionController.DoorHandle corridorDoorHandleForRoom(long roomId) {
        CorridorSelectionContext context = selectedCorridorContext();
        if (context == null) {
            return null;
        }
        return context.geometry().doors().stream()
                .filter(door -> door.roomId() == roomId)
                .findFirst()
                .map(door -> new CorridorEditInteractionController.DoorHandle(context.corridor().corridorId(), roomId))
                .orElse(null);
    }

    protected final CorridorEditInteractionController.DoorDragPreview projectCorridorDoorDragPreview(
            double screenX,
            double screenY,
            CorridorEditInteractionController.DoorHandle handle,
            double previewHalfLength
    ) {
        CorridorEditInteractionController.DoorHandle normalizedHandle = normalizeCorridorDoorHandle(handle);
        if (normalizedHandle == null || layout == null) {
            return null;
        }
        DoorEdgeProjection projection = nearestCorridorDoorProjection(screenX, screenY, normalizedHandle);
        if (projection == null) {
            return null;
        }
        // Drag previews stay continuous so the door can follow the pointer along the wall;
        // persistence still snaps back to one discrete room edge on release.
        CorridorEditInteractionController.DoorMoveTarget snapTarget = new CorridorEditInteractionController.DoorMoveTarget(
                projection.roomId(),
                projection.roomCell(),
                projection.direction());
        CorridorEditInteractionController.DoorPreviewSegment previewSegment = previewDoorSegment(projection, previewHalfLength);
        return new CorridorEditInteractionController.DoorDragPreview(snapTarget, previewSegment);
    }

    protected final int insertIndexForSegment(long corridorId, CorridorGeometry geometry, int segmentIndex) {
        List<Integer> waypointPathIndices = corridorWaypointPathIndices(corridorId, geometry);
        List<Point2i> path = renderData == null ? List.of() : renderData.corridorPath(corridorId);
        if (path.isEmpty() || geometry == null || geometry.waypointCells().isEmpty()) {
            return geometry == null ? 0 : geometry.waypointCells().size();
        }
        int pathIndexAfterSegment = Math.min(segmentIndex + 1, path.size() - 1);
        int insertIndex = 0;
        while (insertIndex < waypointPathIndices.size() && waypointPathIndices.get(insertIndex) <= pathIndexAfterSegment) {
            insertIndex++;
        }
        return insertIndex;
    }

    protected final CorridorEditInteractionController.WaypointHandle waypointHandleForSegmentRemoval(
            CorridorSelectionContext context,
            double screenX,
            double screenY,
            int segmentIndex
    ) {
        List<Point2i> waypointCells = context == null ? List.of() : context.geometry().waypointCells();
        if (context == null || segmentIndex < 0 || waypointCells.isEmpty()) {
            return null;
        }
        List<Point2i> path = renderData == null ? List.of() : renderData.corridorPath(context.corridor().corridorId());
        List<Integer> waypointPathIndices = corridorWaypointPathIndices(context.corridor().corridorId(), context.geometry());
        if (path.size() < 2 || waypointPathIndices.isEmpty()) {
            return null;
        }
        int segmentStartPathIndex = Math.min(segmentIndex, path.size() - 2);
        int segmentEndPathIndex = segmentStartPathIndex + 1;
        Integer previousWaypointIndex = null;
        Integer nextWaypointIndex = null;
        for (int index = 0; index < waypointPathIndices.size(); index++) {
            int waypointPathIndex = waypointPathIndices.get(index);
            if (waypointPathIndex <= segmentStartPathIndex) {
                previousWaypointIndex = index;
            }
            if (waypointPathIndex >= segmentEndPathIndex) {
                nextWaypointIndex = index;
                break;
            }
        }
        int candidateIndex;
        if (previousWaypointIndex == null) {
            candidateIndex = nextWaypointIndex == null ? -1 : nextWaypointIndex;
        } else if (nextWaypointIndex == null) {
            candidateIndex = previousWaypointIndex;
        } else {
            Point2i previousWaypoint = waypointCells.get(previousWaypointIndex);
            Point2i nextWaypoint = waypointCells.get(nextWaypointIndex);
            double previousDistance = distanceToRoomCell(screenX, screenY, previousWaypoint);
            double nextDistance = distanceToRoomCell(screenX, screenY, nextWaypoint);
            candidateIndex = previousDistance <= nextDistance ? previousWaypointIndex : nextWaypointIndex;
        }
        if (candidateIndex < 0) {
            return null;
        }
        return new CorridorEditInteractionController.WaypointHandle(context.corridor().corridorId(), candidateIndex);
    }

    private List<Integer> corridorWaypointPathIndices(long corridorId, CorridorGeometry geometry) {
        List<Point2i> path = renderData == null ? List.of() : renderData.corridorPath(corridorId);
        if (path.isEmpty() || geometry == null || geometry.waypointCells().isEmpty()) {
            return List.of();
        }
        List<Integer> waypointPathIndices = new java.util.ArrayList<>();
        int searchStartIndex = 0;
        for (Point2i waypoint : geometry.waypointCells()) {
            int exactIndex = -1;
            for (int index = searchStartIndex; index < path.size(); index++) {
                if (path.get(index).equals(waypoint)) {
                    exactIndex = index;
                    break;
                }
            }
            if (exactIndex >= 0) {
                waypointPathIndices.add(exactIndex);
                searchStartIndex = Math.min(exactIndex + 1, path.size() - 1);
                continue;
            }
            int bestIndex = Math.min(searchStartIndex, path.size() - 1);
            int bestDistance = Integer.MAX_VALUE;
            for (int index = searchStartIndex; index < path.size(); index++) {
                Point2i pathPoint = path.get(index);
                int distance = Math.abs(pathPoint.x() - waypoint.x()) + Math.abs(pathPoint.y() - waypoint.y());
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = index;
                }
            }
            waypointPathIndices.add(bestIndex);
            searchStartIndex = Math.min(bestIndex + 1, path.size() - 1);
        }
        return waypointPathIndices;
    }

    public final CorridorEditInteractionController.PressMode corridorPressMode() {
        return corridorEditController.previewPressMode();
    }

    public final boolean updateCorridorPressMode(MouseEvent event) {
        return corridorEditController.updatePreviewPressMode(event);
    }

    protected final boolean hasClusterDragPreview() {
        return !previewState.clusterCenters().isEmpty();
    }

    protected final CorridorEditInteractionController.DoorDragPreview corridorDoorPreview() {
        return previewState.previewCorridorDoorDrag();
    }

    protected final boolean isPreviewDoor(long corridorId, long roomId) {
        CorridorEditInteractionController.DoorDragPreview previewDrag = previewState.previewCorridorDoorDrag();
        CorridorEditInteractionController.DoorHandle previewHandle = previewState.previewCorridorDoorHandle();
        long previewRoomId = previewDrag != null && previewDrag.snapTarget() != null
                ? previewDrag.snapTarget().roomId()
                : previewHandle == null ? Long.MIN_VALUE : previewHandle.roomId();
        return previewHandle != null
                && previewHandle.corridorId() == corridorId
                && previewRoomId == roomId
                && previewDrag != null;
    }

    public final boolean updateCorridorDoorPreview(
            CorridorEditInteractionController.DoorHandle handle,
            CorridorEditInteractionController.DoorDragPreview preview
    ) {
        if (hasClusterDragPreview()) {
            return clearCorridorDoorPreview();
        }
        if (handle == null || preview == null || preview.previewSegment() == null || preview.snapTarget() == null) {
            return clearCorridorDoorPreview();
        }
        if (Objects.equals(previewState.previewCorridorDoorHandle(), handle)
                && Objects.equals(previewState.previewCorridorDoorDrag(), preview)) {
            return false;
        }
        previewState.setPreviewCorridorDoorHandle(handle);
        previewState.setPreviewCorridorDoorDrag(preview);
        return true;
    }

    public final boolean clearCorridorDoorPreview() {
        if (previewState.previewCorridorDoorHandle() == null && previewState.previewCorridorDoorDrag() == null) {
            return false;
        }
        previewState.setPreviewCorridorDoorHandle(null);
        previewState.setPreviewCorridorDoorDrag(null);
        return true;
    }

    private List<DungeonRoom> doorProjectionRooms(CorridorEditInteractionController.DoorHandle handle) {
        if (layout == null || handle == null) {
            return List.of();
        }
        DungeonCorridor corridor = layout.corridorById(handle.corridorId());
        if (corridor == null) {
            return List.of();
        }
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (Long roomId : corridor.roomIds()) {
            DungeonRoom room = layout.roomById(roomId);
            if (room != null) {
                clusterIds.add(room.clusterId());
            }
        }
        return layout.rooms().stream()
                .filter(Objects::nonNull)
                .filter(room -> room.roomId() != null)
                .filter(room -> clusterIds.contains(room.clusterId()))
                .toList();
    }

    private void rebuildClusterDragPreviewInternal() {
        if (layout == null || previewState.clusterCenters().isEmpty()) {
            previewTopologySession.reset();
        } else {
            previewTopologySession.rebuild(layout, renderData, previewState.clusterCenters(), this::previewCenter, this::previewDelta);
        }
    }

    public abstract DungeonEditorSurface surface();

    public DungeonRoomCluster findClusterInSelection(Point2i startInclusive, Point2i endInclusive) {
        return null;
    }

    public boolean canCreateGraphRoomAt(Point2i world) {
        return true;
    }

    protected final Set<Point2i> roomCellsFor(DungeonRoom room) {
        if (room == null) {
            return Set.of();
        }
        Point2i delta = previewDelta(room.clusterId());
        if (delta.equals(ZERO) && renderData != null) {
            return layout.roomCells(room.roomId());
        }
        return translateCells(layout.roomCells(room.roomId()), delta);
    }

    protected final List<List<Point2i>> roomLoopsFor(DungeonRoom room) {
        if (room == null) {
            return List.of();
        }
        Point2i center = previewCenter(room);
        return DungeonRoomGeometry.absoluteLoops(DungeonRoomGeometry.roomShapeForCells(roomCellsFor(room), center));
    }

    public final Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null) {
            return Set.of();
        }
        Point2i delta = previewDelta(cluster.clusterId());
        if (delta.equals(ZERO)) {
            return layout.clusterCells(cluster.clusterId());
        }
        return translateCells(layout.clusterCells(cluster.clusterId()), delta);
    }

    protected final List<List<Point2i>> clusterLoopsFor(DungeonRoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null) {
            return List.of();
        }
        Point2i delta = previewDelta(cluster.clusterId());
        if (delta.equals(ZERO)) {
            return layout.clusterLoops(cluster.clusterId());
        }
        return translateLoops(layout.clusterLoops(cluster.clusterId()), delta);
    }

    protected final Point2i previewDelta(Long clusterId) {
        if (clusterId == null || layout == null) {
            return ZERO;
        }
        DungeonRoomCluster cluster = layout.clusterById(clusterId);
        Point2i previewCenter = previewState.clusterCenters().get(clusterId);
        if (cluster == null || previewCenter == null) {
            return ZERO;
        }
        return previewCenter.subtract(cluster.center());
    }

    private Set<Point2i> translateCells(Set<Point2i> cells, Point2i delta) {
        Set<Point2i> translated = new LinkedHashSet<>();
        for (Point2i cell : cells) {
            translated.add(cell.add(delta));
        }
        return translated;
    }

    protected final DungeonRoom previewRoomAtCell(Point2i cell) {
        return previewTopologySession.roomAtCell(cell);
    }

    protected final DungeonRoomCluster previewClusterAtCell(Point2i cell) {
        return previewTopologySession.clusterAtCell(cell);
    }

    private List<List<Point2i>> translateLoops(List<List<Point2i>> loops, Point2i delta) {
        return loops.stream()
                .map(loop -> loop.stream()
                        .map(point -> point.add(delta))
                        .toList())
                .toList();
    }

    protected final boolean sameDoorSegment(DoorSegment left, DoorSegment right) {
        return (left.start().equals(right.start()) && left.end().equals(right.end()))
                || (left.start().equals(right.end()) && left.end().equals(right.start()));
    }

    protected final double distanceToDoor(double screenX, double screenY, DoorSegment door) {
        return distanceToSegment(
                screenX,
                screenY,
                camera.toScreenX(door.start().x()),
                camera.toScreenY(door.start().y()),
                camera.toScreenX(door.end().x()),
                camera.toScreenY(door.end().y()));
    }

    protected final double distanceToSegment(double screenX, double screenY, Point2i from, Point2i to) {
        return distanceToSegment(
                screenX,
                screenY,
                camera.toScreenX(from.x() + 0.5),
                camera.toScreenY(from.y() + 0.5),
                camera.toScreenX(to.x() + 0.5),
                camera.toScreenY(to.y() + 0.5));
    }

    protected final double distanceToRoomCell(double screenX, double screenY, Point2i roomCell) {
        double centerX = camera.toScreenX(roomCell.x() + 0.5);
        double centerY = camera.toScreenY(roomCell.y() + 0.5);
        return Math.hypot(screenX - centerX, screenY - centerY);
    }

    protected final double distanceToSegment(double screenX, double screenY, double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared == 0) {
            return Math.hypot(screenX - x1, screenY - y1);
        }
        double t = Math.max(0, Math.min(1, ((screenX - x1) * dx + (screenY - y1) * dy) / lengthSquared));
        double px = x1 + t * dx;
        double py = y1 + t * dy;
        return Math.hypot(screenX - px, screenY - py);
    }

    private boolean isZeroOffset(Point2D offset) {
        return offset == null || offset.equals(Point2D.ZERO);
    }

    protected final double distanceToInvalidCorridorLink(double screenX, double screenY, CorridorGeometry geometry) {
        InvalidCorridorLink link = invalidCorridorLink(geometry);
        if (link == null) {
            return Double.POSITIVE_INFINITY;
        }
        return distanceToSegment(
                screenX,
                screenY,
                camera.toScreenX(previewCenter(link.from()).x() + 0.5),
                camera.toScreenY(previewCenter(link.from()).y() + 0.5),
                camera.toScreenX(previewCenter(link.to()).x() + 0.5),
                camera.toScreenY(previewCenter(link.to()).y() + 0.5));
    }

    protected final void strokeInvalidCorridorLink(GraphicsContext gc, CorridorGeometry geometry) {
        InvalidCorridorLink link = invalidCorridorLink(geometry);
        if (link == null) {
            return;
        }
        gc.strokeLine(
                camera.toScreenX(previewCenter(link.from()).x() + 0.5),
                camera.toScreenY(previewCenter(link.from()).y() + 0.5),
                camera.toScreenX(previewCenter(link.to()).x() + 0.5),
                camera.toScreenY(previewCenter(link.to()).y() + 0.5));
    }

    protected final InvalidCorridorLink invalidCorridorLink(CorridorGeometry geometry) {
        if (geometry == null || renderData == null || geometry.roomIds().size() < 2) {
            return null;
        }
        DungeonRoom from = layout == null ? null : layout.roomById(geometry.roomIds().get(0));
        DungeonRoom to = layout == null ? null : layout.roomById(geometry.roomIds().get(1));
        if (from == null || to == null) {
            return null;
        }
        return new InvalidCorridorLink(from, to);
    }

    private DoorEdgeProjection nearestCorridorDoorProjection(
            double screenX,
            double screenY,
            CorridorEditInteractionController.DoorHandle handle
    ) {
        double worldX = camera.toWorldX(screenX);
        double worldY = camera.toWorldY(screenY);
        DoorEdgeProjection bestProjection = null;
        double bestDistanceSquared = Double.POSITIVE_INFINITY;
        for (DungeonRoom room : doorProjectionRooms(handle)) {
            Set<Point2i> roomCells = roomCellsFor(room);
            for (Point2i roomCell : roomCells) {
                for (DungeonRoomCluster.EdgeDirection direction : DungeonRoomCluster.EdgeDirection.values()) {
                    Point2i outsideCell = roomCell.add(direction.delta());
                    if (roomCells.contains(outsideCell) || isOccupiedByOtherRoom(room.roomId(), outsideCell)) {
                        continue;
                    }
                    EdgeVertices vertices = edgeVertices(roomCell, direction);
                    double projectionT = projectionT(
                            worldX,
                            worldY,
                            vertices.start().x(),
                            vertices.start().y(),
                            vertices.end().x(),
                            vertices.end().y());
                    double projectedX = lerp(vertices.start().x(), vertices.end().x(), projectionT);
                    double projectedY = lerp(vertices.start().y(), vertices.end().y(), projectionT);
                    double distanceSquared = squaredDistance(worldX, worldY, projectedX, projectedY);
                    if (distanceSquared < bestDistanceSquared) {
                        bestDistanceSquared = distanceSquared;
                        bestProjection = new DoorEdgeProjection(
                                room.roomId(),
                                roomCell,
                                direction,
                                vertices,
                                projectionT,
                                projectedX,
                                projectedY);
                    }
                }
            }
        }
        return bestProjection;
    }

    private CorridorEditInteractionController.DoorPreviewSegment previewDoorSegment(
            DoorEdgeProjection projection,
            double previewHalfLength
    ) {
        double startT = Math.max(0.0, projection.projectionT() - previewHalfLength);
        double endT = Math.min(1.0, projection.projectionT() + previewHalfLength);
        double startWorldX = lerp(projection.vertices().start().x(), projection.vertices().end().x(), startT);
        double startWorldY = lerp(projection.vertices().start().y(), projection.vertices().end().y(), startT);
        double endWorldX = lerp(projection.vertices().start().x(), projection.vertices().end().x(), endT);
        double endWorldY = lerp(projection.vertices().start().y(), projection.vertices().end().y(), endT);
        return new CorridorEditInteractionController.DoorPreviewSegment(
                startWorldX,
                startWorldY,
                endWorldX,
                endWorldY,
                projection.projectedWorldX(),
                projection.projectedWorldY());
    }

    protected final EdgeVertices edgeVertices(Point2i cell, DungeonRoomCluster.EdgeDirection direction) {
        return switch (direction) {
            case NORTH -> new EdgeVertices(new Point2i(cell.x(), cell.y()), new Point2i(cell.x() + 1, cell.y()));
            case EAST -> new EdgeVertices(new Point2i(cell.x() + 1, cell.y()), new Point2i(cell.x() + 1, cell.y() + 1));
            case SOUTH -> new EdgeVertices(new Point2i(cell.x(), cell.y() + 1), new Point2i(cell.x() + 1, cell.y() + 1));
            case WEST -> new EdgeVertices(new Point2i(cell.x(), cell.y()), new Point2i(cell.x(), cell.y() + 1));
        };
    }

    private void resizeCanvas() {
        canvas.setWidth(Math.max(160, getWidth()));
        canvas.setHeight(Math.max(160, getHeight()));
        render();
    }

    private void render() {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        DungeonCanvasTheme.paintBackground(gc, canvas.getWidth(), canvas.getHeight());
        if (layout == null) {
            return;
        }
        renderContent(gc);
    }

    protected final int selectionMinX() {
        return Math.min(interactionState.selectionStartCell().x(), interactionState.selectionEndCell().x());
    }

    protected final int selectionMaxX() {
        return Math.max(interactionState.selectionStartCell().x(), interactionState.selectionEndCell().x());
    }

    protected final int selectionMinY() {
        return Math.min(interactionState.selectionStartCell().y(), interactionState.selectionEndCell().y());
    }

    protected final int selectionMaxY() {
        return Math.max(interactionState.selectionStartCell().y(), interactionState.selectionEndCell().y());
    }

    public final void clearSelectionPreview() {
        interactionState.clearSelection();
        corridorEditController.clearPreviewPressMode();
        clearCorridorDoorPreview();
    }

    public final void clearPaintPreview() {
        previewState.paintCells().clear();
        interactionState.clearPaint();
    }

    public final void rebuildPaintPreviewCells() {
        previewState.paintCells().clear();
        if (interactionState.paintStartCell() == null || interactionState.paintEndCell() == null) {
            return;
        }
        int minX = Math.min(interactionState.paintStartCell().x(), interactionState.paintEndCell().x());
        int maxX = Math.max(interactionState.paintStartCell().x(), interactionState.paintEndCell().x());
        int minY = Math.min(interactionState.paintStartCell().y(), interactionState.paintEndCell().y());
        int maxY = Math.max(interactionState.paintStartCell().y(), interactionState.paintEndCell().y());
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                previewState.paintCells().add(new Point2i(x, y));
            }
        }
    }

    public final void beginSelection(Point2i world) {
        if (Objects.equals(interactionState.selectionStartCell(), world) && Objects.equals(interactionState.selectionEndCell(), world)) {
            return;
        }
        interactionState.setSelectionStartCell(world);
        interactionState.setSelectionEndCell(world);
        render();
    }

    public final void updateSelectionPreview(Point2i world) {
        if (Objects.equals(interactionState.selectionEndCell(), world)) {
            return;
        }
        interactionState.setSelectionEndCell(world);
        render();
    }

    public final void commitSelection(Point2i start, Point2i end) {
        interactionState.setSelectionStartCell(start);
        interactionState.setSelectionEndCell(end);
        DungeonRoomCluster selectedCluster = findClusterInSelection(start, end);
        if (selectedCluster != null) {
            callbacks.onClusterSelected().accept(selectedCluster);
        }
        clearSelectionPreview();
        render();
    }

    public final void beginPaint(Point2i world) {
        if (Objects.equals(interactionState.paintStartCell(), world)
                && Objects.equals(interactionState.paintEndCell(), world)
                && !previewState.paintCells().isEmpty()) {
            return;
        }
        interactionState.setPaintStartCell(world);
        interactionState.setPaintEndCell(world);
        rebuildPaintPreviewCells();
        render();
    }

    public final void updatePaintPreview(Point2i world) {
        if (Objects.equals(interactionState.paintEndCell(), world)) {
            return;
        }
        interactionState.setPaintEndCell(world);
        rebuildPaintPreviewCells();
        render();
    }

    public final void commitPaint(Point2i world) {
        interactionState.setPaintEndCell(world);
        rebuildPaintPreviewCells();
        if (!previewState.paintCells().isEmpty()) {
            if (editorTool == DungeonEditorTool.ROOM_DELETE) {
                callbacks.onRoomCellsDeleted().accept(Set.copyOf(previewState.paintCells()));
            } else {
                callbacks.onRoomCellsPainted().accept(Set.copyOf(previewState.paintCells()));
            }
        }
        clearPaintPreview();
        render();
    }

    public final void updateDragPreview(DungeonPaneInteractionState.DragInteraction dragInteraction, Point2i world) {
        double worldX = camera.toWorldX(interactionState.lastPointerScreenX());
        double worldY = camera.toWorldY(interactionState.lastPointerScreenY());
        double previewCenterX = dragInteraction.originalCenter().x() + (worldX - dragInteraction.anchorWorldX());
        double previewCenterY = dragInteraction.originalCenter().y() + (worldY - dragInteraction.anchorWorldY());
        Point2i snappedPreviewCenter = snapDraggedCenter(previewCenterX, previewCenterY);
        Point2D previewOffset = new Point2D(
                previewCenterX - snappedPreviewCenter.x(),
                previewCenterY - snappedPreviewCenter.y());
        Point2i previousCenter = previewState.clusterCenters().get(dragInteraction.cluster().clusterId());
        Point2D previousOffset = previewState.clusterOffsets().get(dragInteraction.cluster().clusterId());
        if (Objects.equals(previousCenter, snappedPreviewCenter)
                && Objects.equals(previousOffset, previewOffset)) {
            return;
        }
        previewState.clusterCenters().put(dragInteraction.cluster().clusterId(), snappedPreviewCenter);
        previewState.clusterOffsets().put(dragInteraction.cluster().clusterId(), previewOffset);
        if (!Objects.equals(previousCenter, snappedPreviewCenter)) {
            rebuildClusterDragPreviewInternal();
        }
        render();
    }

    public final void commitDrag(DungeonPaneInteractionState.DragInteraction dragInteraction, Point2i world) {
        double worldX = camera.toWorldX(interactionState.lastPointerScreenX());
        double worldY = camera.toWorldY(interactionState.lastPointerScreenY());
        Point2i newCenter = snapDraggedCenter(
                dragInteraction.originalCenter().x() + (worldX - dragInteraction.anchorWorldX()),
                dragInteraction.originalCenter().y() + (worldY - dragInteraction.anchorWorldY()));
        if (!newCenter.equals(dragInteraction.originalCenter())) {
            // Keep the drag preview visible until the async move result replaces the layout.
            // Dropping the preview immediately would repaint the stale layout for one frame.
            callbacks.onClusterMoved().accept(dragInteraction.cluster(), newCenter);
        } else {
            previewState.clusterCenters().remove(dragInteraction.cluster().clusterId());
            previewState.clusterOffsets().remove(dragInteraction.cluster().clusterId());
            rebuildClusterDragPreviewInternal();
            render();
        }
    }

    public final void applySelectedCorridorDoorHandle(
            CorridorEditInteractionController.DoorHandle handle,
            boolean notify,
            boolean renderNow
    ) {
        CorridorEditInteractionController.DoorHandle normalizedHandle = normalizeCorridorDoorHandle(handle);
        if (Objects.equals(previewState.selectedCorridorDoorHandle(), normalizedHandle)) {
            if (renderNow) {
                render();
            }
            return;
        }
        previewState.setSelectedCorridorDoorHandle(normalizedHandle);
        if (notify) {
            callbacks.onCorridorDoorSelectionChanged().accept(previewState.selectedCorridorDoorHandle());
        }
        if (renderNow) {
            render();
        }
    }

    public final boolean updateHoveredCorridorAt(double screenX, double screenY) {
        Long nextHoveredCorridorId = null;
        if (layout != null && editorTool == DungeonEditorTool.SELECT) {
            DungeonRoomCluster hoveredCluster = findClusterAt(screenX, screenY);
            DungeonRoom hoveredRoom = hoveredCluster == null ? findRoomAt(screenX, screenY) : null;
            if (hoveredCluster == null && hoveredRoom == null) {
                DungeonCorridor corridor = findCorridorAt(screenX, screenY);
                nextHoveredCorridorId = corridor == null ? null : corridor.corridorId();
            }
        }
        if (Objects.equals(previewState.hoveredCorridorId(), nextHoveredCorridorId)) {
            return false;
        }
        previewState.setHoveredCorridorId(nextHoveredCorridorId);
        return true;
    }

    public final boolean clearHoveredCorridor() {
        if (previewState.hoveredCorridorId() == null) {
            return false;
        }
        previewState.setHoveredCorridorId(null);
        return true;
    }

    public final void updatePointerPosition(MouseEvent event) {
        interactionState.setPointerInsideCanvas(true);
        interactionState.setLastPointerScreenX(event.getX());
        interactionState.setLastPointerScreenY(event.getY());
    }

    public final void refreshHoverAfterProjectionChange() {
        if (!interactionState.pointerInsideCanvas()) {
            if (clearHoveredCorridor()) {
                render();
            }
            return;
        }
        if (updateHoveredCorridorAt(interactionState.lastPointerScreenX(), interactionState.lastPointerScreenY())) {
            render();
        }
    }

    public final void onPointerExited() {
        interactionState.setPointerInsideCanvas(false);
        if (clearHoveredCorridor()) {
            render();
        }
    }

    private static double projectionT(double px, double py, double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared == 0) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(1.0, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    }

    private static double squaredDistance(double x1, double y1, double x2, double y2) {
        double dx = x1 - x2;
        double dy = y1 - y2;
        return dx * dx + dy * dy;
    }

    private static double lerp(double start, double end, double t) {
        return start + (end - start) * t;
    }

    private CorridorEditInteractionController.DoorHandle normalizeCorridorDoorHandle(CorridorEditInteractionController.DoorHandle handle) {
        if (handle == null || editorTool != DungeonEditorTool.SELECT) {
            return null;
        }
        CorridorSelectionContext context = selectedCorridorContext();
        if (context == null || handle.corridorId() != context.corridor().corridorId()) {
            return null;
        }
        return context.geometry().doors().stream()
                .anyMatch(door -> door.roomId() == handle.roomId())
                ? handle
                : null;
    }

    private boolean isOccupiedByOtherRoom(long roomId, Point2i cell) {
        if (layout == null || cell == null) {
            return false;
        }
        for (DungeonRoom candidate : layout.rooms()) {
            if (candidate == null || candidate.roomId() == null || candidate.roomId() == roomId) {
                continue;
            }
            if (roomCellsFor(candidate).contains(cell)) {
                return true;
            }
        }
        return false;
    }

    private Point2i snapDraggedCenter(double worldX, double worldY) {
        return surface() == DungeonEditorSurface.GRAPH
                ? new Point2i((int) Math.round(worldX), (int) Math.round(worldY))
                : new Point2i((int) Math.floor(worldX), (int) Math.floor(worldY));
    }

    private static boolean isZero(double value) {
        return Math.abs(value) < 0.000001;
    }

    protected record InvalidCorridorLink(DungeonRoom from, DungeonRoom to) {
    }

    protected record CorridorSelectionContext(DungeonCorridor corridor, CorridorGeometry geometry) {
    }

    protected record EdgeVertices(Point2i start, Point2i end) {
    }

    private record DoorEdgeProjection(
            long roomId,
            Point2i roomCell,
            DungeonRoomCluster.EdgeDirection direction,
            EdgeVertices vertices,
            double projectionT,
            double projectedWorldX,
            double projectedWorldY
    ) {
    }

    @Override
    public final DungeonLayout dungeonLayout() {
        return layout;
    }

    @Override
    public final DungeonLayoutRenderData renderData() {
        return renderData;
    }

    @Override
    public final DungeonSelection selectedTarget() {
        return selectedTarget;
    }

    @Override
    public final DungeonRuntimeLocation activeLocation() {
        return activeLocation;
    }

    @Override
    public final boolean editable() {
        return editable;
    }

    @Override
    public final void setLayoutState(
            DungeonLayout layout,
            DungeonLayoutRenderData renderData,
            DungeonSelection selectedTarget,
            DungeonRuntimeLocation activeLocation
    ) {
        this.layout = layout;
        this.renderData = renderData;
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        this.corridorLayoutContext = renderData == null ? null : renderData.layoutContext();
    }

    @Override
    public final DungeonEditorTool editorTool() {
        return editorTool;
    }

    @Override
    public final void setEditorToolInternal(DungeonEditorTool editorTool) {
        this.editorTool = editorTool;
    }

    @Override
    public final DungeonPreviewState previewState() {
        return previewState;
    }

    @Override
    public final DungeonPaneInteractionState interactionState() {
        return interactionState;
    }

    @Override
    public final DungeonPaneCallbacks callbacks() {
        return callbacks;
    }

    @Override
    public final DungeonPreviewTopologySession previewTopologySession() {
        return previewTopologySession;
    }

    @Override
    public final void requestRender() {
        render();
    }

    @Override
    public final CorridorEditInteractionController controller() {
        return corridorEditController;
    }

    @Override
    public final WallPathInteractionController wallPathController() {
        return wallPathController;
    }

    @Override
    public final void rebuildClusterDragPreview() {
        rebuildClusterDragPreviewInternal();
    }

    @Override
    public final double worldX(double screenX) {
        return camera.toWorldX(screenX);
    }

    @Override
    public final double worldY(double screenY) {
        return camera.toWorldY(screenY);
    }

    public final Long hoveredCorridorId() {
        return previewState.hoveredCorridorId();
    }

    public final void setHoveredCorridorId(Long corridorId) {
        previewState.setHoveredCorridorId(corridorId);
    }

    @Override
    public final Set<Point2i> previewPaintCells() {
        return previewState.paintCells();
    }

    @Override
    public final DungeonRoomCluster clusterById(long clusterId) {
        return layout == null ? null : layout.clusterById(clusterId);
    }
}
