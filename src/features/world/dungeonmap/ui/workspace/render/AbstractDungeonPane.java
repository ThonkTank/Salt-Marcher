package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.DungeonCorridor;
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

    protected final Canvas canvas = new Canvas();
    protected final DungeonCanvasCamera camera;
    protected DungeonLayout layout;
    protected DungeonLayoutRenderData renderData;
    protected DungeonSelection selectedTarget;
    protected DungeonRuntimeLocation activeLocation;
    protected boolean editable;
    protected final Map<Long, Point2i> previewCenters = new HashMap<>();
    protected final Set<Point2i> previewPaintCells = new LinkedHashSet<>();
    protected DungeonEditorTool editorTool = DungeonEditorTool.SELECT;
    protected Point2i selectionStartCell;
    protected Point2i selectionEndCell;
    protected Point2i paintStartCell;
    protected Point2i paintEndCell;

    private final PaneCallbacks callbacks = new PaneCallbacks();
    private PointerInteraction pointerInteraction = IdleInteraction.INSTANCE;

    protected AbstractDungeonPane(DungeonCanvasCamera camera) {
        this.camera = Objects.requireNonNull(camera, "camera");
        getChildren().add(canvas);
        widthProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        heightProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
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

    public final void setOnClusterWallPainted(Consumer<Set<DungeonClusterEdgeRef>> onClusterWallPainted) {
        callbacks.onClusterWallPainted = Objects.requireNonNull(onClusterWallPainted, "onClusterWallPainted");
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
        this.previewCenters.clear();
        this.previewPaintCells.clear();
        clearSelectionPreview();
        clearPaintPreview();
        if (renderNow) {
            render();
        }
    }

    public final void updateSelection(DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation, boolean renderNow) {
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        if (renderNow) {
            render();
        }
    }

    public final void refreshViewport() {
        render();
    }

    protected final Point2i previewCenter(DungeonRoom room) {
        RoomShape shape = Objects.requireNonNull(layout, "layout").roomShape(room.roomId());
        Point2i center = Objects.requireNonNull(shape, "shape").center();
        return previewCenters.getOrDefault(room.roomId(), center);
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
        Point2i previewCenter = previewCenters.get(room.roomId());
        if (previewCenter == null && renderData != null) {
            return layout.roomCells(room.roomId());
        }
        return roomCellsForShape(room, previewCenter);
    }

    protected final List<List<Point2i>> roomLoopsFor(DungeonRoom room) {
        if (room == null) {
            return List.of();
        }
        Point2i center = previewCenter(room);
        return DungeonRoomGeometry.absoluteLoops(DungeonRoomGeometry.roomShapeForCells(roomCellsForShape(room, center), center));
    }

    private Set<Point2i> roomCellsForShape(DungeonRoom room, Point2i center) {
        RoomShape shape = Objects.requireNonNull(layout, "layout").roomShape(room.roomId());
        Point2i targetCenter = center == null ? shape.center() : center;
        Point2i delta = targetCenter.subtract(shape.center());
        Set<Point2i> translated = new LinkedHashSet<>();
        for (Point2i cell : shape.cells()) {
            translated.add(cell.add(delta));
        }
        return translated;
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
        selectionStartCell = world;
        selectionEndCell = world;
        render();
    }

    private void updateSelectionPreview(Point2i world) {
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
        paintStartCell = world;
        paintEndCell = world;
        rebuildPaintPreviewCells();
        render();
    }

    private void updatePaintPreview(Point2i world) {
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
        for (DungeonRoom room : layout.roomsForCluster(dragInteraction.cluster().clusterId())) {
            previewCenters.put(room.roomId(), previewCenter);
        }
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
            for (DungeonRoom room : layout.roomsForCluster(dragInteraction.cluster().clusterId())) {
                previewCenters.remove(room.roomId());
            }
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

    private void handleMouseDragged(MouseEvent event) {
        if (pointerInteraction instanceof PanInteraction) {
            callbacks.onViewportPanned.accept(new Point2D(event.getX(), event.getY()));
            return;
        }
        Point2i world = worldPointAt(event.getX(), event.getY());
        if (!editable || !(pointerInteraction instanceof DragInteraction dragInteraction)) {
            handlePreviewDrag(world);
            return;
        }
        updateDragPreview(dragInteraction, world);
    }

    private void handleMouseReleased(MouseEvent event) {
        if (pointerInteraction instanceof PanInteraction) {
            pointerInteraction = IdleInteraction.INSTANCE;
            return;
        }
        Point2i world = worldPointAt(event.getX(), event.getY());
        if (handleEditableRelease(world)) {
            return;
        }
        handleDragRelease(world);
    }

    private boolean handlePanPress(MouseEvent event) {
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
                callbacks.onClusterWallPainted.accept(Set.of(edgeRef));
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
                && surface() == EditorSurface.GRID)) {
            return false;
        }
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
        return false;
    }

    private void handleDragRelease(Point2i world) {
        if (!editable || !(pointerInteraction instanceof DragInteraction dragInteraction)) {
            pointerInteraction = IdleInteraction.INSTANCE;
            return;
        }
        pointerInteraction = IdleInteraction.INSTANCE;
        commitDrag(dragInteraction, world);
    }

    private void handleScroll(ScrollEvent event) {
        double factor = event.getDeltaY() > 0 ? 1.1 : 0.9;
        callbacks.onViewportZoomed.handle(event.getX(), event.getY(), factor);
    }

    private static boolean isRoomDragButton(MouseButton button, DungeonEditorTool tool) {
        if (button == MouseButton.MIDDLE) {
            return true;
        }
        // Secondary is reserved for camera panning. Primary only drags in explicit selection mode.
        return button == MouseButton.PRIMARY && tool == DungeonEditorTool.SELECT;
    }

    private sealed interface PointerInteraction
            permits IdleInteraction, PanInteraction, SelectionInteraction, PaintInteraction, DragInteraction, GraphCreateInteraction, GraphDeleteInteraction {
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

    private static final class PaneCallbacks {
        private Consumer<DungeonRoom> onRoomSelected = room -> { };
        private Consumer<DungeonRoomCluster> onClusterSelected = cluster -> { };
        private Consumer<DungeonCorridor> onCorridorSelected = corridor -> { };
        private BiConsumer<DungeonRoom, Point2i> onRoomMoved = (room, center) -> { };
        private BiConsumer<DungeonRoomCluster, Point2i> onClusterMoved = (cluster, center) -> { };
        private Consumer<DungeonCorridorEndpoint> onCorridorEndpointSelected = location -> { };
        private Consumer<Set<Point2i>> onRoomCellsPainted = cells -> { };
        private Consumer<Set<Point2i>> onRoomCellsDeleted = cells -> { };
        private Consumer<Set<DungeonClusterEdgeRef>> onClusterWallPainted = refs -> { };
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
