package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.CorridorDoorOverride;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonCorridorGeometry;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DoorSegment;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomGeometry;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.DungeonRuntimeLocation;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.model.RoomShape;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import javafx.geometry.Point2D;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.StackPane;

import java.util.LinkedHashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

abstract class AbstractDungeonPane extends StackPane {

    protected static final double CORRIDOR_DOOR_PREVIEW_HALF_LENGTH = 0.35;
    private static final Point2i ZERO = new Point2i(0, 0);

    protected final Canvas canvas = new Canvas();
    protected final DungeonCanvasCamera camera;
    protected DungeonLayout layout;
    protected DungeonLayoutRenderData renderData;
    protected DungeonSelection selectedTarget;
    protected DungeonRuntimeLocation activeLocation;
    protected boolean editable;
    protected final Map<Long, Point2i> previewClusterCenters = new HashMap<>();
    protected final Set<Point2i> previewPaintCells = new LinkedHashSet<>();
    protected DungeonEditorTool editorTool = DungeonEditorTool.SELECT;
    protected Point2i selectionStartCell;
    protected Point2i selectionEndCell;
    protected Point2i paintStartCell;
    protected Point2i paintEndCell;
    protected CorridorEditInteractionController.DoorHandle selectedCorridorDoorHandle;
    protected Long hoveredCorridorId;
    protected CorridorEditInteractionController.DoorHandle previewCorridorDoorHandle;
    protected CorridorEditInteractionController.DoorDragPreview previewCorridorDoorDrag;
    protected CorridorGeometry previewCorridorGeometry;
    protected DungeonCorridorGeometry.LayoutContext corridorLayoutContext;
    private double lastPointerScreenX;
    private double lastPointerScreenY;
    private boolean pointerInsideCanvas;

    private final PaneCallbacks callbacks = new PaneCallbacks();
    private final CorridorEditInteractionController corridorEditController;
    private final WallPathInteractionController wallPathController;
    private PointerInteraction pointerInteraction = IdleInteraction.INSTANCE;

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
            public EditorSurface surface() {
                return AbstractDungeonPane.this.surface();
            }

            @Override
            public DungeonClusterEdgeRef findClusterEdgeAt(double screenX, double screenY) {
                return AbstractDungeonPane.this.findClusterEdgeAt(screenX, screenY);
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
        setFocusTraversable(true);
        getChildren().add(canvas);
        widthProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        heightProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        addEventHandler(KeyEvent.KEY_PRESSED, this::handleKeyPressed);
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, event -> requestFocus());
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        canvas.addEventHandler(MouseEvent.MOUSE_MOVED, this::handleMouseMoved);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
        canvas.addEventHandler(MouseEvent.MOUSE_EXITED, event -> {
            pointerInsideCanvas = false;
            if (clearHoveredCorridor()) {
                render();
            }
        });
        canvas.addEventHandler(ScrollEvent.SCROLL, this::handleScroll);
    }

    public final void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        callbacks.onRoomSelected = Objects.requireNonNull(onRoomSelected, "onRoomSelected");
    }

    public final void setOnClusterSelected(Consumer<DungeonRoomCluster> onClusterSelected) {
        callbacks.onClusterSelected = Objects.requireNonNull(onClusterSelected, "onClusterSelected");
    }

    public final void setOnCorridorSelected(Consumer<DungeonCorridor> onCorridorSelected) {
        callbacks.onCorridorSelected = Objects.requireNonNull(onCorridorSelected, "onCorridorSelected");
    }

    public final void setOnRoomMoved(BiConsumer<DungeonRoom, Point2i> onRoomMoved) {
        callbacks.onRoomMoved = Objects.requireNonNull(onRoomMoved, "onRoomMoved");
    }

    public final void setOnClusterMoved(BiConsumer<DungeonRoomCluster, Point2i> onClusterMoved) {
        callbacks.onClusterMoved = Objects.requireNonNull(onClusterMoved, "onClusterMoved");
    }

    public final void setOnCorridorEndpointSelected(Consumer<DungeonCorridorEndpoint> onCorridorEndpointSelected) {
        callbacks.onCorridorEndpointSelected = Objects.requireNonNull(onCorridorEndpointSelected, "onCorridorEndpointSelected");
    }

    public final void setEditable(boolean editable) {
        this.editable = editable;
    }

    public final void setEditorTool(DungeonEditorTool editorTool) {
        this.editorTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        previewPaintCells.clear();
        clearSelectionPreview();
        clearPaintPreview();
        wallPathController.reset();
        corridorEditController.cancel();
        clearCorridorDoorPreview();
        clearHoveredCorridor();
        if (this.editorTool != DungeonEditorTool.SELECT) {
            applySelectedCorridorDoorHandle(null, false, false);
        } else {
            applySelectedCorridorDoorHandle(selectedCorridorDoorHandle, false, false);
        }
        render();
    }

    public final void setOnViewportPanStarted(Consumer<Point2D> onViewportPanStarted) {
        callbacks.onViewportPanStarted = Objects.requireNonNull(onViewportPanStarted, "onViewportPanStarted");
    }

    public final void setOnViewportPanned(Consumer<Point2D> onViewportPanned) {
        callbacks.onViewportPanned = Objects.requireNonNull(onViewportPanned, "onViewportPanned");
    }

    public final void setOnViewportZoomed(DungeonViewportZoomHandler onViewportZoomed) {
        callbacks.onViewportZoomed = Objects.requireNonNull(onViewportZoomed, "onViewportZoomed");
    }

    public final void setOnRoomCellsPainted(Consumer<Set<Point2i>> onRoomCellsPainted) {
        callbacks.onRoomCellsPainted = Objects.requireNonNull(onRoomCellsPainted, "onRoomCellsPainted");
    }

    public final void setOnRoomCellsDeleted(Consumer<Set<Point2i>> onRoomCellsDeleted) {
        callbacks.onRoomCellsDeleted = Objects.requireNonNull(onRoomCellsDeleted, "onRoomCellsDeleted");
    }

    public final void setOnClusterDoorPainted(Consumer<Set<DungeonClusterEdgeRef>> onClusterDoorPainted) {
        callbacks.onClusterDoorPainted = Objects.requireNonNull(onClusterDoorPainted, "onClusterDoorPainted");
    }

    public final void setOnGraphRoomRequested(Consumer<Point2i> onGraphRoomRequested) {
        callbacks.onGraphRoomRequested = Objects.requireNonNull(onGraphRoomRequested, "onGraphRoomRequested");
    }

    public final void setOnGraphRoomDeleted(Consumer<DungeonRoom> onGraphRoomDeleted) {
        callbacks.onGraphRoomDeleted = Objects.requireNonNull(onGraphRoomDeleted, "onGraphRoomDeleted");
    }

    public final void setOnGraphClusterDeleted(Consumer<DungeonRoomCluster> onGraphClusterDeleted) {
        callbacks.onGraphClusterDeleted = Objects.requireNonNull(onGraphClusterDeleted, "onGraphClusterDeleted");
    }

    public final void setOnCorridorDeleted(Consumer<DungeonCorridor> onCorridorDeleted) {
        callbacks.onCorridorDeleted = Objects.requireNonNull(onCorridorDeleted, "onCorridorDeleted");
    }

    public final void setOnCorridorRoomRemoved(Consumer<CorridorDoorHit> onCorridorRoomRemoved) {
        callbacks.onCorridorRoomRemoved = Objects.requireNonNull(onCorridorRoomRemoved, "onCorridorRoomRemoved");
    }

    public final void setOnCorridorDoorSelected(Consumer<CorridorEditInteractionController.DoorHandle> onCorridorDoorSelected) {
        Consumer<CorridorEditInteractionController.DoorHandle> consumer = Objects.requireNonNull(onCorridorDoorSelected, "onCorridorDoorSelected");
        corridorEditController.setOnCorridorDoorSelected(handle -> {
            applySelectedCorridorDoorHandle(handle, true, true);
            consumer.accept(selectedCorridorDoorHandle);
        });
    }

    public final void setOnCorridorDoorSelectionChanged(Consumer<CorridorEditInteractionController.DoorHandle> onCorridorDoorSelectionChanged) {
        callbacks.onCorridorDoorSelectionChanged = Objects.requireNonNull(onCorridorDoorSelectionChanged, "onCorridorDoorSelectionChanged");
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
        this.layout = layout;
        this.renderData = renderData;
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        this.corridorLayoutContext = layout == null ? null : DungeonCorridorGeometry.layoutContext(layout);
        this.previewClusterCenters.clear();
        this.previewPaintCells.clear();
        clearSelectionPreview();
        clearPaintPreview();
        wallPathController.reset();
        corridorEditController.cancel();
        clearCorridorDoorPreview();
        clearHoveredCorridor();
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle, false, false);
        if (renderNow) {
            render();
        }
    }

    public final void updateSelection(DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation, boolean renderNow) {
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        clearCorridorDoorPreview();
        clearHoveredCorridor();
        applySelectedCorridorDoorHandle(selectedCorridorDoorHandle, false, false);
        if (renderNow) {
            render();
        }
    }

    public final CorridorEditInteractionController.DoorHandle selectedCorridorDoorHandle() {
        return selectedCorridorDoorHandle;
    }

    public final void setSelectedCorridorDoorHandle(CorridorEditInteractionController.DoorHandle handle) {
        applySelectedCorridorDoorHandle(handle, false, true);
    }

    public final void refreshViewport() {
        render();
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
        return false;
    }

    protected final boolean isSelected(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || selectedTarget == null) {
            return false;
        }
        return selectedTarget.selectsCorridor(corridor.corridorId());
    }

    protected final boolean isHovered(DungeonCorridor corridor) {
        return corridor != null && corridor.corridorId() != null && Objects.equals(hoveredCorridorId, corridor.corridorId());
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

    protected abstract Point2i worldPointAt(double screenX, double screenY);

    protected abstract DungeonRoomCluster findClusterAt(double screenX, double screenY);

    protected abstract DungeonRoom findRoomAt(double screenX, double screenY);

    protected abstract DungeonCorridor findCorridorAt(double screenX, double screenY);

    protected DungeonClusterEdgeRef findClusterEdgeAt(double screenX, double screenY) {
        return null;
    }

    protected DungeonCorridorEndpoint corridorEndpointLocationAt(double screenX, double screenY, DungeonRoom room, DungeonCorridor corridor) {
        if (room != null && room.roomId() != null) {
            return DungeonCorridorEndpoint.room(room.roomId());
        }
        if (corridor != null && corridor.corridorId() != null) {
            return DungeonCorridorEndpoint.corridor(corridor.corridorId());
        }
        return null;
    }

    protected CorridorDoorHit findCorridorDoorHitAt(double screenX, double screenY) {
        return null;
    }

    protected CorridorEditInteractionController.DoorHandle findCorridorDoorHandleAt(double screenX, double screenY) {
        return null;
    }

    protected CorridorEditInteractionController.DoorDragPreview corridorDoorDragPreviewAt(
            double screenX,
            double screenY,
            CorridorEditInteractionController.DoorHandle handle
    ) {
        return null;
    }

    protected CorridorEditInteractionController.WaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY) {
        return null;
    }

    protected int corridorSegmentIndexAt(double screenX, double screenY) {
        return -1;
    }

    protected CorridorEditInteractionController.WaypointHandle findCorridorWaypointRemoveHandleAt(double screenX, double screenY) {
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

    protected CorridorEditInteractionController.SegmentInsertHit findCorridorSegmentInsertHitAt(double screenX, double screenY) {
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

    protected final CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null) {
            return null;
        }
        if (previewCorridorGeometry != null
                && previewCorridorDoorHandle != null
                && previewCorridorDoorHandle.corridorId() == corridor.corridorId()) {
            return previewCorridorGeometry;
        }
        return renderData == null ? null : renderData.corridorGeometry(corridor.corridorId());
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
        return handle != null && handle.equals(selectedCorridorDoorHandle);
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
        DungeonRoom room = layout.roomById(normalizedHandle.roomId());
        if (room == null) {
            return null;
        }
        DoorEdgeProjection projection = nearestCorridorDoorProjection(screenX, screenY, normalizedHandle, room);
        if (projection == null) {
            return null;
        }
        // Drag previews stay continuous so the door can follow the pointer along the wall;
        // persistence still snaps back to one discrete room edge on release.
        CorridorEditInteractionController.DoorMoveTarget snapTarget = new CorridorEditInteractionController.DoorMoveTarget(
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

    protected final CorridorEditInteractionController.PressMode corridorPressMode() {
        return corridorEditController.previewPressMode();
    }

    protected final boolean updateCorridorPressMode(MouseEvent event) {
        return corridorEditController.updatePreviewPressMode(event);
    }

    protected final boolean hasClusterDragPreview() {
        return !previewClusterCenters.isEmpty();
    }

    protected final CorridorEditInteractionController.DoorDragPreview corridorDoorPreview() {
        return previewCorridorDoorDrag;
    }

    protected final boolean isPreviewDoor(long corridorId, long roomId) {
        return previewCorridorDoorHandle != null
                && previewCorridorDoorHandle.corridorId() == corridorId
                && previewCorridorDoorHandle.roomId() == roomId
                && previewCorridorDoorDrag != null;
    }

    private boolean updateCorridorDoorPreview(
            CorridorEditInteractionController.DoorHandle handle,
            CorridorEditInteractionController.DoorDragPreview preview
    ) {
        if (hasClusterDragPreview()) {
            return clearCorridorDoorPreview();
        }
        if (handle == null || preview == null || preview.previewSegment() == null || preview.snapTarget() == null) {
            return clearCorridorDoorPreview();
        }
        if (Objects.equals(previewCorridorDoorHandle, handle)
                && Objects.equals(previewCorridorDoorDrag, preview)) {
            return false;
        }
        CorridorGeometry nextGeometry = buildCorridorDoorPreviewGeometry(handle, preview);
        if (nextGeometry == null) {
            return clearCorridorDoorPreview();
        }
        previewCorridorDoorHandle = handle;
        previewCorridorDoorDrag = preview;
        previewCorridorGeometry = nextGeometry;
        return true;
    }

    private boolean clearCorridorDoorPreview() {
        if (previewCorridorDoorHandle == null && previewCorridorDoorDrag == null && previewCorridorGeometry == null) {
            return false;
        }
        previewCorridorDoorHandle = null;
        previewCorridorDoorDrag = null;
        previewCorridorGeometry = null;
        return true;
    }

    private CorridorGeometry buildCorridorDoorPreviewGeometry(
            CorridorEditInteractionController.DoorHandle handle,
            CorridorEditInteractionController.DoorDragPreview preview
    ) {
        if (layout == null || handle == null || preview == null || preview.snapTarget() == null || corridorLayoutContext == null) {
            return null;
        }
        CorridorEditInteractionController.DoorMoveTarget target = preview.snapTarget();
        DungeonCorridor corridor = layout.corridorById(handle.corridorId());
        DungeonRoom room = layout.roomById(handle.roomId());
        if (corridor == null || room == null) {
            return null;
        }
        DungeonRoomCluster cluster = layout.clusterById(room.clusterId());
        if (cluster == null) {
            return null;
        }
        CorridorDoorOverride override = new CorridorDoorOverride(
                room.roomId(),
                room.clusterId(),
                target.roomCell().subtract(cluster.center()),
                target.direction());
        List<CorridorDoorOverride> overrides = corridor.doorOverrides().stream()
                .filter(existing -> existing.roomId() != room.roomId())
                .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));
        overrides.add(override);
        DungeonCorridor previewCorridor = new DungeonCorridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.roomIds(),
                overrides,
                corridor.waypoints());
        return DungeonCorridorGeometry.corridorGeometry(layout, previewCorridor, corridorLayoutContext);
    }

    protected abstract EditorSurface surface();

    protected DungeonRoomCluster findClusterInSelection(Point2i startInclusive, Point2i endInclusive) {
        return null;
    }

    protected boolean canCreateGraphRoomAt(Point2i world) {
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

    protected final Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
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
        Point2i previewCenter = previewClusterCenters.get(clusterId);
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
            CorridorEditInteractionController.DoorHandle handle,
            DungeonRoom room
    ) {
        Set<Point2i> roomCells = roomCellsFor(room);
        double worldX = camera.toWorldX(screenX);
        double worldY = camera.toWorldY(screenY);
        DoorEdgeProjection bestProjection = null;
        double bestDistanceSquared = Double.POSITIVE_INFINITY;
        for (Point2i roomCell : roomCells) {
            for (DungeonRoomCluster.EdgeDirection direction : DungeonRoomCluster.EdgeDirection.values()) {
                Point2i outsideCell = roomCell.add(direction.delta());
                if (roomCells.contains(outsideCell) || isOccupiedByOtherRoom(handle.roomId(), outsideCell)) {
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
                            roomCell,
                            direction,
                            vertices,
                            projectionT,
                            projectedX,
                            projectedY);
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
        return Math.min(selectionStartCell.x(), selectionEndCell.x());
    }

    protected final int selectionMaxX() {
        return Math.max(selectionStartCell.x(), selectionEndCell.x());
    }

    protected final int selectionMinY() {
        return Math.min(selectionStartCell.y(), selectionEndCell.y());
    }

    protected final int selectionMaxY() {
        return Math.max(selectionStartCell.y(), selectionEndCell.y());
    }

    private void clearSelectionPreview() {
        selectionStartCell = null;
        selectionEndCell = null;
        corridorEditController.clearPreviewPressMode();
        clearCorridorDoorPreview();
    }

    private void clearPaintPreview() {
        previewPaintCells.clear();
        paintStartCell = null;
        paintEndCell = null;
    }

    private void rebuildPaintPreviewCells() {
        previewPaintCells.clear();
        if (paintStartCell == null || paintEndCell == null) {
            return;
        }
        int minX = Math.min(paintStartCell.x(), paintEndCell.x());
        int maxX = Math.max(paintStartCell.x(), paintEndCell.x());
        int minY = Math.min(paintStartCell.y(), paintEndCell.y());
        int maxY = Math.max(paintStartCell.y(), paintEndCell.y());
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                previewPaintCells.add(new Point2i(x, y));
            }
        }
    }

    protected enum EditorSurface {
        GRID,
        GRAPH
    }

    private void beginSelection(Point2i world) {
        if (Objects.equals(selectionStartCell, world) && Objects.equals(selectionEndCell, world)) {
            return;
        }
        selectionStartCell = world;
        selectionEndCell = world;
        render();
    }

    private void updateSelectionPreview(Point2i world) {
        if (Objects.equals(selectionEndCell, world)) {
            return;
        }
        selectionEndCell = world;
        render();
    }

    private void commitSelection(Point2i start, Point2i end) {
        selectionStartCell = start;
        selectionEndCell = end;
        DungeonRoomCluster selectedCluster = findClusterInSelection(start, end);
        if (selectedCluster != null) {
            callbacks.onClusterSelected.accept(selectedCluster);
        }
        clearSelectionPreview();
        render();
    }

    private void beginPaint(Point2i world) {
        if (Objects.equals(paintStartCell, world) && Objects.equals(paintEndCell, world) && !previewPaintCells.isEmpty()) {
            return;
        }
        paintStartCell = world;
        paintEndCell = world;
        rebuildPaintPreviewCells();
        render();
    }

    private void updatePaintPreview(Point2i world) {
        if (Objects.equals(paintEndCell, world)) {
            return;
        }
        paintEndCell = world;
        rebuildPaintPreviewCells();
        render();
    }

    private void commitPaint(Point2i world) {
        paintEndCell = world;
        rebuildPaintPreviewCells();
        if (!previewPaintCells.isEmpty()) {
            if (editorTool == DungeonEditorTool.ROOM_DELETE) {
                callbacks.onRoomCellsDeleted.accept(Set.copyOf(previewPaintCells));
            } else {
                callbacks.onRoomCellsPainted.accept(Set.copyOf(previewPaintCells));
            }
        }
        clearPaintPreview();
        render();
    }

    private void updateDragPreview(DragInteraction dragInteraction, Point2i world) {
        Point2i delta = world.subtract(dragInteraction.anchorWorld());
        Point2i previewCenter = dragInteraction.originalCenter().add(delta);
        if (Objects.equals(previewClusterCenters.get(dragInteraction.cluster().clusterId()), previewCenter)) {
            return;
        }
        previewClusterCenters.put(dragInteraction.cluster().clusterId(), previewCenter);
        render();
    }

    private void commitDrag(DragInteraction dragInteraction, Point2i world) {
        Point2i delta = world.subtract(dragInteraction.anchorWorld());
        Point2i newCenter = dragInteraction.originalCenter().add(delta);
        if (!newCenter.equals(dragInteraction.originalCenter())) {
            // Keep the drag preview visible until the async move result replaces the layout.
            // Dropping the preview immediately would repaint the stale layout for one frame.
            callbacks.onClusterMoved.accept(dragInteraction.cluster(), newCenter);
        } else {
            previewClusterCenters.remove(dragInteraction.cluster().clusterId());
            render();
        }
    }

    private void handleMousePressed(MouseEvent event) {
        if (layout == null) {
            return;
        }
        if (handlePanPress(event)) {
            return;
        }
        CorridorEditInteractionController.PressHit corridorPressHit = corridorEditController.hitTest(event);
        if (corridorEditController.handlePress(corridorPressHit)) {
            return;
        }
        PointerContext context = pointerContext(event);
        if (handleRoomToolPress(event, context)) {
            return;
        }
        if (handleCorridorToolPress(event, context)) {
            return;
        }
        if (handleRoomDragPress(event, context)) {
            return;
        }
        if (handleSelectionPress(event, context)) {
            return;
        }
        if (context.corridor() != null) {
            callbacks.onCorridorSelected.accept(context.corridor());
            return;
        }
        if (context.cluster() != null) {
            callbacks.onClusterSelected.accept(context.cluster());
            return;
        }
        if (context.room() != null) {
            callbacks.onRoomSelected.accept(context.room());
            return;
        }
        pointerInteraction = IdleInteraction.INSTANCE;
    }

    private void handleMouseMoved(MouseEvent event) {
        updatePointerPosition(event);
        boolean corridorPreviewChanged = updateCorridorPressMode(event) | updateHoveredCorridor(event);
        if (corridorPreviewChanged) {
            render();
        }
        wallPathController.handlePointerMove(event.getX(), event.getY());
    }

    private void handleMouseDragged(MouseEvent event) {
        updatePointerPosition(event);
        boolean corridorPreviewChanged = updateCorridorPressMode(event) | updateHoveredCorridor(event);
        if (corridorPreviewChanged) {
            render();
        }
        if (pointerInteraction instanceof PanInteraction) {
            callbacks.onViewportPanned.accept(new Point2D(event.getX(), event.getY()));
            refreshHoverAfterProjectionChange();
            return;
        }
        if (corridorEditController.handleDrag(event)) {
            render();
            return;
        }
        wallPathController.handlePointerMove(event.getX(), event.getY());
        Point2i world = worldPointAt(event.getX(), event.getY());
        if (!editable || !(pointerInteraction instanceof DragInteraction dragInteraction)) {
            handlePreviewDrag(world);
            return;
        }
        updateDragPreview(dragInteraction, world);
    }

    private void handleMouseReleased(MouseEvent event) {
        if (updateCorridorPressMode(event)) {
            render();
        }
        if (pointerInteraction instanceof PanInteraction) {
            pointerInteraction = IdleInteraction.INSTANCE;
            return;
        }
        Point2i world = worldPointAt(event.getX(), event.getY());
        if (handleEditableRelease(world)) {
            return;
        }
        handleDragRelease(event, world);
    }

    private boolean handlePanPress(MouseEvent event) {
        if (updateCorridorPressMode(event)) {
            render();
        }
        if (event.getButton() == MouseButton.SECONDARY && wallPathController.handleSecondaryPress()) {
            render();
            return true;
        }
        if (event.getButton() != MouseButton.SECONDARY) {
            return false;
        }
        pointerInteraction = new PanInteraction();
        callbacks.onViewportPanStarted.accept(new Point2D(event.getX(), event.getY()));
        return true;
    }

    private PointerContext pointerContext(MouseEvent event) {
        return new PointerContext(
                worldPointAt(event.getX(), event.getY()),
                findClusterAt(event.getX(), event.getY()),
                findRoomAt(event.getX(), event.getY()),
                findCorridorAt(event.getX(), event.getY()),
                findCorridorDoorHitAt(event.getX(), event.getY()));
    }

    private boolean handleRoomToolPress(MouseEvent event, PointerContext context) {
        if (!editable || event.getButton() != MouseButton.PRIMARY) {
            return false;
        }
        if ((editorTool == DungeonEditorTool.CLUSTER_WALL || editorTool == DungeonEditorTool.CLUSTER_DOOR)
                && surface() == EditorSurface.GRID) {
            DungeonClusterEdgeRef edgeRef = findClusterEdgeAt(event.getX(), event.getY());
            if (edgeRef == null) {
                return false;
            }
            if (editorTool == DungeonEditorTool.CLUSTER_WALL) {
                wallPathController.handlePrimaryPress(event.getX(), event.getY());
            } else {
                callbacks.onClusterDoorPainted.accept(Set.of(edgeRef));
            }
            return true;
        }
        if (editorTool != DungeonEditorTool.ROOM_PAINT && editorTool != DungeonEditorTool.ROOM_DELETE) {
            return false;
        }
        if (surface() == EditorSurface.GRID) {
            beginPaint(context.world());
            pointerInteraction = new PaintInteraction();
            return true;
        }
        if (surface() != EditorSurface.GRAPH) {
            return false;
        }
        if (editorTool == DungeonEditorTool.ROOM_PAINT
                && context.cluster() == null
                && context.room() == null
                && canCreateGraphRoomAt(context.world())) {
            pointerInteraction = new GraphCreateInteraction(context.world());
            return true;
        }
        if (editorTool == DungeonEditorTool.ROOM_DELETE && context.cluster() != null) {
            pointerInteraction = new GraphDeleteInteraction(context.cluster());
            return true;
        }
        return false;
    }

    private boolean handleCorridorToolPress(MouseEvent event, PointerContext context) {
        if (!editable || event.getButton() != MouseButton.PRIMARY) {
            return false;
        }
        if (editorTool != DungeonEditorTool.CORRIDOR_CREATE && editorTool != DungeonEditorTool.CORRIDOR_DELETE) {
            return false;
        }
        if (editorTool == DungeonEditorTool.CORRIDOR_CREATE) {
            DungeonCorridorEndpoint endpoint = corridorEndpointLocationAt(event.getX(), event.getY(), context.room(), context.corridor());
            if (endpoint != null) {
                callbacks.onCorridorEndpointSelected.accept(endpoint);
                return true;
            }
            if (context.corridor() != null) {
                callbacks.onCorridorEndpointSelected.accept(DungeonCorridorEndpoint.corridor(context.corridor().corridorId()));
                return true;
            }
            return false;
        }
        if (context.corridorDoorHit() != null) {
            callbacks.onCorridorRoomRemoved.accept(context.corridorDoorHit());
            return true;
        }
        if (context.corridor() != null) {
            callbacks.onCorridorDeleted.accept(context.corridor());
            return true;
        }
        return false;
    }

    private boolean handleRoomDragPress(MouseEvent event, PointerContext context) {
        if (!(editable && context.cluster() != null && isRoomDragButton(event.getButton(), editorTool))) {
            return false;
        }
        callbacks.onClusterSelected.accept(context.cluster());
        pointerInteraction = new DragInteraction(context.cluster(), context.cluster().center(), context.world());
        return true;
    }

    private boolean handleSelectionPress(MouseEvent event, PointerContext context) {
        if (!(editable
                && event.getButton() == MouseButton.PRIMARY
                && editorTool == DungeonEditorTool.SELECT
                && surface() == EditorSurface.GRID
                && context.corridor() == null
                && context.cluster() == null
                && context.room() == null)) {
            return false;
        }
        // Occupied hits should select the visible entity directly; marquee selection is for empty space only.
        beginSelection(context.world());
        pointerInteraction = new SelectionInteraction(context.world());
        return true;
    }

    private void handlePreviewDrag(Point2i world) {
        if (editable && pointerInteraction instanceof PaintInteraction) {
            updatePaintPreview(world);
        }
        if (editable && pointerInteraction instanceof SelectionInteraction) {
            updateSelectionPreview(world);
        }
    }

    private boolean handleEditableRelease(Point2i world) {
        if (editable && pointerInteraction instanceof SelectionInteraction selectionInteraction) {
            pointerInteraction = IdleInteraction.INSTANCE;
            commitSelection(selectionInteraction.anchorWorld(), world);
            return true;
        }
        if (editable && pointerInteraction instanceof PaintInteraction) {
            pointerInteraction = IdleInteraction.INSTANCE;
            commitPaint(world);
            return true;
        }
        if (editable && pointerInteraction instanceof GraphCreateInteraction graphCreateInteraction) {
            pointerInteraction = IdleInteraction.INSTANCE;
            callbacks.onGraphRoomRequested.accept(graphCreateInteraction.world());
            return true;
        }
        if (editable && pointerInteraction instanceof GraphDeleteInteraction graphDeleteInteraction) {
            pointerInteraction = IdleInteraction.INSTANCE;
            callbacks.onGraphClusterDeleted.accept(graphDeleteInteraction.cluster());
            return true;
        }
        if (corridorEditController.handleEditableRelease(world)) {
            pointerInteraction = IdleInteraction.INSTANCE;
            return true;
        }
        return false;
    }

    private void handleDragRelease(MouseEvent event, Point2i world) {
        if (!editable) {
            clearCorridorDoorPreview();
            pointerInteraction = IdleInteraction.INSTANCE;
            return;
        }
        if (pointerInteraction instanceof DragInteraction dragInteraction) {
            pointerInteraction = IdleInteraction.INSTANCE;
            commitDrag(dragInteraction, world);
            return;
        }
        if (corridorEditController.handleDragRelease(event)) {
            pointerInteraction = IdleInteraction.INSTANCE;
            render();
            return;
        }
        pointerInteraction = IdleInteraction.INSTANCE;
    }

    private void handleScroll(ScrollEvent event) {
        pointerInsideCanvas = true;
        lastPointerScreenX = event.getX();
        lastPointerScreenY = event.getY();
        double factor = event.getDeltaY() > 0 ? 1.1 : 0.9;
        callbacks.onViewportZoomed.handle(event.getX(), event.getY(), factor);
        refreshHoverAfterProjectionChange();
    }

    private void handleKeyPressed(KeyEvent event) {
        wallPathController.handleKeyPressed(event);
    }

    private static boolean isRoomDragButton(MouseButton button, DungeonEditorTool tool) {
        if (button == MouseButton.MIDDLE) {
            return true;
        }
        // Secondary is reserved for camera panning. Primary only drags in explicit selection mode.
        return button == MouseButton.PRIMARY && tool == DungeonEditorTool.SELECT;
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

    private void applySelectedCorridorDoorHandle(
            CorridorEditInteractionController.DoorHandle handle,
            boolean notify,
            boolean renderNow
    ) {
        CorridorEditInteractionController.DoorHandle normalizedHandle = normalizeCorridorDoorHandle(handle);
        if (Objects.equals(selectedCorridorDoorHandle, normalizedHandle)) {
            if (renderNow) {
                render();
            }
            return;
        }
        selectedCorridorDoorHandle = normalizedHandle;
        if (notify) {
            callbacks.onCorridorDoorSelectionChanged.accept(selectedCorridorDoorHandle);
        }
        if (renderNow) {
            render();
        }
    }

    private boolean updateHoveredCorridor(MouseEvent event) {
        return updateHoveredCorridorAt(event.getX(), event.getY());
    }

    private boolean updateHoveredCorridorAt(double screenX, double screenY) {
        Long nextHoveredCorridorId = null;
        if (layout != null && editorTool == DungeonEditorTool.SELECT) {
            DungeonRoomCluster hoveredCluster = findClusterAt(screenX, screenY);
            DungeonRoom hoveredRoom = hoveredCluster == null ? findRoomAt(screenX, screenY) : null;
            if (hoveredCluster == null && hoveredRoom == null) {
                DungeonCorridor corridor = findCorridorAt(screenX, screenY);
                nextHoveredCorridorId = corridor == null ? null : corridor.corridorId();
            }
        }
        if (Objects.equals(hoveredCorridorId, nextHoveredCorridorId)) {
            return false;
        }
        hoveredCorridorId = nextHoveredCorridorId;
        return true;
    }

    private boolean clearHoveredCorridor() {
        if (hoveredCorridorId == null) {
            return false;
        }
        hoveredCorridorId = null;
        return true;
    }

    private void updatePointerPosition(MouseEvent event) {
        pointerInsideCanvas = true;
        lastPointerScreenX = event.getX();
        lastPointerScreenY = event.getY();
    }

    private void refreshHoverAfterProjectionChange() {
        if (!pointerInsideCanvas) {
            if (clearHoveredCorridor()) {
                render();
            }
            return;
        }
        if (updateHoveredCorridorAt(lastPointerScreenX, lastPointerScreenY)) {
            render();
        }
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

    private sealed interface PointerInteraction
            permits IdleInteraction, PanInteraction, SelectionInteraction, PaintInteraction, DragInteraction,
            GraphCreateInteraction, GraphDeleteInteraction {
    }

    private enum IdleInteraction implements PointerInteraction {
        INSTANCE
    }

    private static final class PanInteraction implements PointerInteraction {
    }

    private record SelectionInteraction(Point2i anchorWorld) implements PointerInteraction {
    }

    private record PaintInteraction() implements PointerInteraction {
    }

    private record DragInteraction(DungeonRoomCluster cluster, Point2i originalCenter, Point2i anchorWorld) implements PointerInteraction {
    }

    private record GraphCreateInteraction(Point2i world) implements PointerInteraction {
    }

    private record GraphDeleteInteraction(DungeonRoomCluster cluster) implements PointerInteraction {
    }

    private record PointerContext(
            Point2i world,
            DungeonRoomCluster cluster,
            DungeonRoom room,
            DungeonCorridor corridor,
            CorridorDoorHit corridorDoorHit
    ) {
    }

    protected record InvalidCorridorLink(DungeonRoom from, DungeonRoom to) {
    }

    protected record CorridorSelectionContext(DungeonCorridor corridor, CorridorGeometry geometry) {
    }

    protected record EdgeVertices(Point2i start, Point2i end) {
    }

    private record DoorEdgeProjection(
            Point2i roomCell,
            DungeonRoomCluster.EdgeDirection direction,
            EdgeVertices vertices,
            double projectionT,
            double projectedWorldX,
            double projectedWorldY
    ) {
    }

    private static final class PaneCallbacks {
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
        private Consumer<Point2i> onGraphRoomRequested = point -> { };
        private Consumer<DungeonRoom> onGraphRoomDeleted = room -> { };
        private Consumer<DungeonRoomCluster> onGraphClusterDeleted = cluster -> { };
        private Consumer<DungeonCorridor> onCorridorDeleted = corridor -> { };
        private Consumer<CorridorDoorHit> onCorridorRoomRemoved = hit -> { };
        private Consumer<Point2D> onViewportPanStarted = point -> { };
        private Consumer<Point2D> onViewportPanned = point -> { };
        private DungeonViewportZoomHandler onViewportZoomed = (screenX, screenY, factor) -> { };
    }
}
