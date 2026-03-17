package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.CorridorComponent;
import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DoorSegment;
import features.world.dungeonmap.model.GridSegment;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomGeometry;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.DungeonRuntimeLocation;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.model.RoomShape;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonGraphPane extends AbstractDungeonPane {
    private static final double NODE_RADIUS = 16;
    private static final double NODE_CENTER_RADIUS = 3;
    private static final double SHARED_SEGMENT_OFFSET = 7.0;
    private static final double MAX_SHARED_OFFSET = 20.0;
    private static final Color[] GRAPH_GROUP_COLORS = {
            Color.web("#e56b6f"),
            Color.web("#4fb286"),
            Color.web("#6c8cff"),
            Color.web("#f4a259"),
            Color.web("#d17dd7"),
            Color.web("#5cc8d7"),
            Color.web("#d8c15c"),
            Color.web("#e07a5f")
    };
    private DungeonLayout cachedRenderStateLayout;
    private DungeonLayoutRenderData cachedRenderStateData;
    private Map<Long, Point2i> cachedPreviewCenters = Map.of();
    private Map<Long, Point2D> cachedPreviewOffsets = Map.of();
    private CorridorEditInteractionController.DoorHandle cachedPreviewDoorHandle;
    private CorridorEditInteractionController.DoorDragPreview cachedPreviewDoorDrag;
    private long cachedCameraProjectionVersion = -1;
    private CorridorRenderState cachedCorridorRenderState;

    public DungeonGraphPane(DungeonCanvasCamera camera) {
        super(camera);
    }

    @Override
    protected void renderContent(GraphicsContext gc) {
        CorridorRenderState corridorRenderState = corridorRenderState();
        Map<Long, ClusterAnchorLayout> anchorLayouts = new HashMap<>();
        drawRoomOutlines(gc);
        drawCorridorComponentOutlines(gc);
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometry(corridor);
            if (geometry == null) {
                continue;
            }
            if (geometry.routable()) {
                Point2D previewOffset = corridorPreviewOffset(corridor);
                gc.setStroke(strokeColor(corridor));
                gc.setLineWidth(isSelected(corridor) ? 4 : isHovered(corridor) ? 3.5 : 3);
                gc.setLineDashes(null);
                drawCorridorPath(gc, corridorRenderState.displayPaths().get(corridor.corridorId()), previewOffset);
                drawCorridorDoors(gc, corridor, geometry);
                drawCorridorSegmentHandles(gc, corridorRenderState.displayPaths().get(corridor.corridorId()), corridor, previewOffset);
                drawCorridorDoorMarkers(
                        gc,
                        corridor,
                        geometry,
                        corridorRenderState.corridorIdsByDoorMarker(),
                        corridorRenderState.laneOrderBySegment(),
                        corridorRenderState.displayPaths().get(corridor.corridorId()),
                        previewOffset);
                drawCorridorWaypointMarkers(gc, corridor, geometry, previewOffset);
            } else {
                drawInvalidCorridor(gc, corridor, geometry);
            }
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            if (cluster.clusterId() == null) {
                continue;
            }
            ClusterAnchorLayout anchorLayout = anchorLayout(anchorLayouts, cluster);
            ClusterAnchorLayout.AnchorPosition clusterAnchor = clusterAnchorPosition(cluster, anchorLayout);
            double screenX = clusterAnchor.x();
            double screenY = clusterAnchor.y();
            boolean active = isActive(cluster);
            boolean selected = isSelected(cluster);
            gc.setFill(active ? DungeonCanvasTheme.GRAPH_NODE_ACTIVE_FILL : DungeonCanvasTheme.GRAPH_NODE_FILL);
            gc.fillOval(screenX - NODE_RADIUS, screenY - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2);
            gc.setStroke(selected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.ROOM_STROKE);
            gc.setLineWidth(selected ? 3 : 2);
            gc.strokeOval(screenX - NODE_RADIUS, screenY - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2);
            gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
            gc.fillOval(
                    screenX - NODE_CENTER_RADIUS,
                    screenY - NODE_CENTER_RADIUS,
                    NODE_CENTER_RADIUS * 2,
                    NODE_CENTER_RADIUS * 2);
            DungeonCanvasTheme.drawCenteredLabel(gc, "Cluster " + cluster.clusterId(), screenX, screenY);
            drawRoomSubNodes(gc, cluster, anchorLayout);
        }
    }

    @Override
    protected Point2i worldPointAt(double screenX, double screenY) {
        int x = (int) Math.round(camera.toWorldX(screenX));
        int y = (int) Math.round(camera.toWorldY(screenY));
        return new Point2i(x, y);
    }

    @Override
    protected DungeonRoomCluster findClusterAt(double screenX, double screenY) {
        DungeonRoomCluster closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        Map<Long, ClusterAnchorLayout> anchorLayouts = new HashMap<>();
        for (DungeonRoomCluster cluster : layout.clusters()) {
            ClusterAnchorLayout anchorLayout = anchorLayout(anchorLayouts, cluster);
            ClusterAnchorLayout.AnchorPosition anchor = clusterAnchorPosition(cluster, anchorLayout);
            double centerX = anchor.x();
            double centerY = anchor.y();
            double distance = Math.hypot(centerX - screenX, centerY - screenY);
            if (distance < bestDistance && distance <= NODE_RADIUS) {
                bestDistance = distance;
                closest = cluster;
            }
        }
        return closest;
    }

    @Override
    protected DungeonRoom findRoomAt(double screenX, double screenY) {
        DungeonRoom closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        Map<Long, ClusterAnchorLayout> anchorLayouts = new HashMap<>();
        for (DungeonRoom room : layout.rooms()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            DungeonRoomCluster cluster = layout.clusterById(room.clusterId());
            if (cluster == null) {
                continue;
            }
            ClusterAnchorLayout anchorLayout = anchorLayout(anchorLayouts, cluster);
            ClusterAnchorLayout.AnchorPosition anchor = roomAnchorPosition(anchorLayout, room);
            double centerX = anchor.x();
            double centerY = anchor.y();
            double distance = Math.hypot(centerX - screenX, centerY - screenY);
            if (distance < bestDistance && distance <= 7) {
                bestDistance = distance;
                closest = room;
            }
        }
        return closest;
    }

    @Override
    protected DungeonCorridor findCorridorAt(double screenX, double screenY) {
        if (layout == null || renderData == null) {
            return null;
        }
        CorridorRenderState corridorRenderState = corridorRenderState();
        DungeonCorridor closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometry(corridor);
            if (geometry == null) {
                continue;
            }
            double distance = distanceToGeometry(screenX, screenY, geometry, corridorRenderState.displayPaths().get(corridor.corridorId()));
            if (distance < bestDistance && distance <= 14) {
                bestDistance = distance;
                closest = corridor;
            }
        }
        return closest;
    }

    @Override
    protected CorridorDoorHit findCorridorDoorHitAt(double screenX, double screenY) {
        if (layout == null || renderData == null) {
            return null;
        }
        CorridorRenderState corridorRenderState = corridorRenderState();
        CorridorDoorHit bestHit = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometry(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                MarkerPoint marker = markerPoint(
                        door,
                        corridor.corridorId(),
                        corridorRenderState.corridorIdsByDoorMarker(),
                        corridorRenderState.laneOrderBySegment(),
                        corridorRenderState.displayPaths().get(corridor.corridorId()));
                double markerDistance = Math.hypot(screenX - marker.x(), screenY - marker.y());
                if (markerDistance > 8) {
                    continue;
                }
                if (markerDistance < bestDistance) {
                    bestDistance = markerDistance;
                    bestHit = new CorridorDoorHit(List.of(corridor.corridorId()), door.roomId());
                }
            }
        }
        return bestHit;
    }

    @Override
    protected CorridorEditInteractionController.DoorHandle findCorridorDoorHandleAt(double screenX, double screenY) {
        if (hasClusterDragPreview()) {
            return null;
        }
        CorridorSelectionContext context = selectedCorridorContext();
        if (context == null) {
            return null;
        }
        CorridorRenderState corridorRenderState = corridorRenderState();
        CorridorEditInteractionController.DoorHandle best = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DoorSegment door : context.geometry().doors()) {
            MarkerPoint marker = markerPoint(
                    door,
                    context.corridor().corridorId(),
                    corridorRenderState.corridorIdsByDoorMarker(),
                    corridorRenderState.laneOrderBySegment(),
                    corridorRenderState.displayPaths().get(context.corridor().corridorId()));
            double markerDistance = Math.hypot(screenX - marker.x(), screenY - marker.y());
            if (markerDistance <= 9 && markerDistance < bestDistance) {
                bestDistance = markerDistance;
                best = corridorDoorHandleForRoom(door.roomId());
            }
        }
        return best;
    }

    @Override
    protected CorridorEditInteractionController.DoorDragPreview corridorDoorDragPreviewAt(
            double screenX,
            double screenY,
            CorridorEditInteractionController.DoorHandle handle
    ) {
        if (hasClusterDragPreview()) {
            return null;
        }
        return projectCorridorDoorDragPreview(screenX, screenY, handle, CORRIDOR_DOOR_PREVIEW_HALF_LENGTH);
    }

    @Override
    protected CorridorEditInteractionController.WaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY) {
        CorridorSelectionContext context = selectedCorridorContext();
        if (context == null) {
            return null;
        }
        CorridorEditInteractionController.WaypointHandle best = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (int index = 0; index < context.geometry().waypointCells().size(); index++) {
            Point2i waypoint = context.geometry().waypointCells().get(index);
            double centerX = camera.toScreenX(waypoint.x() + 0.5);
            double centerY = camera.toScreenY(waypoint.y() + 0.5);
            double distance = Math.hypot(screenX - centerX, screenY - centerY);
            if (distance <= 10 && distance < bestDistance) {
                bestDistance = distance;
                best = new CorridorEditInteractionController.WaypointHandle(context.corridor().corridorId(), index);
            }
        }
        return best;
    }

    @Override
    protected int corridorSegmentIndexAt(double screenX, double screenY) {
        CorridorSelectionContext context = selectedCorridorContext();
        CorridorDisplayPath displayPath = context == null ? null : corridorRenderState().displayPaths().get(context.corridor().corridorId());
        if (context == null || displayPath == null || displayPath.segments().isEmpty()) {
            return -1;
        }
        SegmentKey bestSegmentKey = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (OffsetLine segment : displayPath.segments()) {
            if (segment.canonicalSegment() == null) {
                continue;
            }
            double distance = distanceToSegment(screenX, screenY, segment.x1(), segment.y1(), segment.x2(), segment.y2());
            if (distance <= 10 && distance < bestDistance) {
                bestDistance = distance;
                bestSegmentKey = segment.canonicalSegment();
            }
        }
        if (bestSegmentKey == null) {
            return -1;
        }
        return segmentIndexForKey(context.geometry(), bestSegmentKey);
    }

    @Override
    protected EditorSurface surface() {
        return EditorSurface.GRAPH;
    }

    @Override
    protected boolean canCreateGraphRoomAt(Point2i world) {
        if (world == null || layout == null) {
            return false;
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            for (Point2i cell : DungeonRoomGeometry.graphRoomCells(world)) {
                if (clusterCellsFor(cluster).contains(cell)) {
                    return false;
                }
            }
        }
        return true;
    }

    private CorridorRenderState corridorRenderState() {
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        if (cachedCorridorRenderState == null
                || cachedRenderStateLayout != layout
                || cachedRenderStateData != corridorRenderData
                || !cachedPreviewCenters.equals(previewClusterCenters)
                || !cachedPreviewOffsets.equals(previewClusterOffsets)
                || !Objects.equals(cachedPreviewDoorHandle, previewCorridorDoorHandle)
                || !Objects.equals(cachedPreviewDoorDrag, previewCorridorDoorDrag)
                || cachedCameraProjectionVersion != camera.projectionVersion()) {
            cachedRenderStateLayout = layout;
            cachedRenderStateData = corridorRenderData;
            cachedPreviewCenters = Map.copyOf(previewClusterCenters);
            cachedPreviewOffsets = Map.copyOf(previewClusterOffsets);
            cachedPreviewDoorHandle = previewCorridorDoorHandle;
            cachedPreviewDoorDrag = previewCorridorDoorDrag;
            cachedCameraProjectionVersion = camera.projectionVersion();
            cachedCorridorRenderState = buildCorridorRenderState();
        }
        return cachedCorridorRenderState;
    }

    private CorridorRenderState buildCorridorRenderState() {
        Map<SegmentKey, List<Long>> corridorIdsBySegment = corridorIdsBySegment();
        Map<SegmentKey, List<Long>> laneOrderBySegment = laneOrderBySegment(corridorIdsBySegment);
        return new CorridorRenderState(
                laneOrderBySegment,
                corridorIdsByDoorMarker(),
                corridorDisplayPaths(laneOrderBySegment));
    }

    private void drawCorridorSegmentHandles(
            GraphicsContext gc,
            CorridorDisplayPath displayPath,
            DungeonCorridor corridor,
            Point2D previewOffset
    ) {
        CorridorEditInteractionController.PressMode pressMode = corridorPressMode();
        if (!editable
                || editorTool != DungeonEditorTool.SELECT
                || !isSelected(corridor)
                || displayPath == null
                || pressMode == CorridorEditInteractionController.PressMode.DEFAULT) {
            return;
        }
        gc.setStroke(pressMode == CorridorEditInteractionController.PressMode.REMOVE_WAYPOINT
                ? Color.rgb(191, 77, 77, 0.9)
                : Color.rgb(244, 204, 140, 0.9));
        gc.setLineWidth(7);
        for (OffsetLine segment : displayPath.segments()) {
            if (segment.canonicalSegment() == null) {
                continue;
            }
            gc.strokeLine(
                    segment.x1() + screenDeltaX(previewOffset),
                    segment.y1() + screenDeltaY(previewOffset),
                    segment.x2() + screenDeltaX(previewOffset),
                    segment.y2() + screenDeltaY(previewOffset));
        }
    }

    private void drawRoomOutlines(GraphicsContext gc) {
        if (layout == null || renderData == null) {
            return;
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            gc.setStroke(isSelected(cluster)
                    ? DungeonCanvasTheme.GRAPH_ROOM_OUTLINE_SELECTED
                    : DungeonCanvasTheme.GRAPH_ROOM_OUTLINE);
            gc.setLineWidth(isSelected(cluster) ? 2.5 : 1.5);
            for (List<Point2i> loop : clusterLoopsFor(cluster)) {
                if (loop.isEmpty()) {
                    continue;
                }
                double[] xs = new double[loop.size()];
                double[] ys = new double[loop.size()];
                Point2D previewOffset = previewOffset(cluster.clusterId());
                for (int i = 0; i < loop.size(); i++) {
                    xs[i] = previewScreenX(loop.get(i).x(), previewOffset);
                    ys[i] = previewScreenY(loop.get(i).y(), previewOffset);
                }
                gc.strokePolygon(xs, ys, loop.size());
            }
        }
    }

    private void drawRoomSubNodes(GraphicsContext gc, DungeonRoomCluster cluster, ClusterAnchorLayout anchorLayout) {
        for (DungeonRoom room : layout.rooms()) {
            if (!Objects.equals(room.clusterId(), cluster.clusterId())) {
                continue;
            }
            ClusterAnchorLayout.AnchorPosition clusterAnchor = clusterAnchorPosition(cluster, anchorLayout);
            ClusterAnchorLayout.AnchorPosition roomAnchor = roomAnchorPosition(anchorLayout, room);
            double clusterX = clusterAnchor.x();
            double clusterY = clusterAnchor.y();
            double roomX = roomAnchor.x();
            double roomY = roomAnchor.y();
            gc.setStroke(DungeonCanvasTheme.GRAPH_ROOM_OUTLINE);
            gc.setLineWidth(1);
            gc.strokeLine(clusterX, clusterY, roomX, roomY);
            gc.setFill(DungeonCanvasTheme.GRAPH_NODE_FILL.deriveColor(0, 1, 1, 0.65));
            gc.fillOval(roomX - 7, roomY - 7, 14, 14);
            gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
            gc.setLineWidth(1.5);
            gc.strokeOval(roomX - 7, roomY - 7, 14, 14);
            DungeonCanvasTheme.drawCenteredLabel(gc, room.name(), roomX, roomY);
        }
    }

    private ClusterAnchorLayout anchorLayout(Map<Long, ClusterAnchorLayout> cache, DungeonRoomCluster cluster) {
        return cache.computeIfAbsent(
                cluster.clusterId(),
                ignored -> ClusterAnchorLayout.forCluster(layout, cluster, this::previewCenter, this::previewCenter));
    }

    private ClusterAnchorLayout.AnchorPosition clusterAnchorPosition(DungeonRoomCluster cluster, ClusterAnchorLayout anchorLayout) {
        Point2i center = anchorLayout.clusterCenter();
        double x = previewScreenX(center.x() + 0.5, cluster.clusterId());
        double y = previewScreenY(center.y() + 0.5, cluster.clusterId());
        return new ClusterAnchorLayout.AnchorPosition(x, anchorLayout.clusterOverlapsRoom() ? y - 12 : y);
    }

    private ClusterAnchorLayout.AnchorPosition roomAnchorPosition(ClusterAnchorLayout anchorLayout, DungeonRoom room) {
        ClusterAnchorLayout.RoomAnchorGroup roomGroup = anchorLayout.roomGroup(room);
        Point2i center = roomGroup.center();
        double x = previewScreenX(center.x() + 0.5, room.clusterId());
        double y = previewScreenY(center.y() + 0.5, room.clusterId());
        double stackOffset = roomGroup.count() <= 1 ? 0 : (roomGroup.index() - (roomGroup.count() - 1) / 2.0) * 16.0;
        if (roomGroup.overlapsCluster(anchorLayout.clusterCenter())) {
            stackOffset += 14;
        }
        return new ClusterAnchorLayout.AnchorPosition(x, y + stackOffset);
    }

    private void drawCorridorComponentOutlines(GraphicsContext gc) {
        if (corridorRenderDataForDisplay() == null) {
            return;
        }
        for (CorridorComponent component : displayedCorridorComponents()) {
            List<Point2i> outline = component.outlineVertices();
            if (outline.isEmpty()) {
                continue;
            }
            gc.setStroke(isComponentSelected(component.componentId())
                    ? DungeonCanvasTheme.CORRIDOR_SELECTED
                    : isComponentActive(component.componentId()) ? DungeonCanvasTheme.CORRIDOR_ACTIVE : DungeonCanvasTheme.GRAPH_ROOM_OUTLINE);
            gc.setLineWidth(isComponentSelected(component.componentId()) ? 3 : 2);
            strokeOutline(gc, outline);
        }
    }

    private List<CorridorComponent> displayedCorridorComponents() {
        if (layout == null) {
            return List.of();
        }
        Map<String, Set<Long>> corridorIdsByComponent = new LinkedHashMap<>();
        Map<String, Set<Long>> roomIdsByComponent = new LinkedHashMap<>();
        Map<String, Set<Point2i>> cellsByComponent = new LinkedHashMap<>();
        Map<String, List<DoorSegment>> doorsByComponent = new LinkedHashMap<>();
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometry(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            String componentId = geometry.componentId() == null
                    ? "preview-corridor:" + corridor.corridorId()
                    : geometry.componentId();
            corridorIdsByComponent.computeIfAbsent(componentId, ignored -> new LinkedHashSet<>()).add(corridor.corridorId());
            roomIdsByComponent.computeIfAbsent(componentId, ignored -> new LinkedHashSet<>()).addAll(geometry.roomIds());
            cellsByComponent.computeIfAbsent(componentId, ignored -> new LinkedHashSet<>()).addAll(geometry.cells());
            doorsByComponent.computeIfAbsent(componentId, ignored -> new ArrayList<>()).addAll(geometry.doors());
        }

        List<CorridorComponent> components = new ArrayList<>();
        for (Map.Entry<String, Set<Point2i>> entry : cellsByComponent.entrySet()) {
            String componentId = entry.getKey();
            Set<Point2i> cells = entry.getValue();
            RoomShape shape = cells.isEmpty() ? null : DungeonRoomGeometry.roomShapeForCells(cells);
            List<Point2i> outlineVertices = shape == null ? List.of() : shape.absoluteVertices();
            components.add(new CorridorComponent(
                    componentId,
                    layout.map().mapId(),
                    Set.copyOf(corridorIdsByComponent.getOrDefault(componentId, Set.of())),
                    Set.copyOf(roomIdsByComponent.getOrDefault(componentId, Set.of())),
                    Set.copyOf(cells),
                    List.copyOf(outlineVertices),
                    List.copyOf(doorsByComponent.getOrDefault(componentId, List.of()))));
        }
        return components;
    }

    private void drawCorridorPath(
            GraphicsContext gc,
            CorridorDisplayPath displayPath,
            Point2D previewOffset
    ) {
        if (displayPath == null || displayPath.segments().isEmpty()) {
            return;
        }
        for (OffsetLine offsetLine : displayPath.segments()) {
            gc.strokeLine(
                    offsetLine.x1() + screenDeltaX(previewOffset),
                    offsetLine.y1() + screenDeltaY(previewOffset),
                    offsetLine.x2() + screenDeltaX(previewOffset),
                    offsetLine.y2() + screenDeltaY(previewOffset));
        }
    }

    private void drawCorridorDoors(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry) {
        if (!geometry.routable()) {
            return;
        }
        gc.setLineWidth(2);
        Point2D previewOffset = corridorPreviewOffset(corridor);
        for (DoorSegment door : geometry.doors()) {
            if (isPreviewDoor(corridor.corridorId(), door.roomId())) {
                continue;
            }
            gc.strokeLine(
                    previewScreenX(door.start().x(), previewOffset),
                    previewScreenY(door.start().y(), previewOffset),
                    previewScreenX(door.end().x(), previewOffset),
                    previewScreenY(door.end().y(), previewOffset));
        }
        drawPreviewDoor(gc, corridor);
    }

    private void drawCorridorDoorMarkers(
            GraphicsContext gc,
            DungeonCorridor corridor,
            CorridorGeometry geometry,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            CorridorDisplayPath displayPath,
            Point2D previewOffset
    ) {
        boolean showDeleteMarkers = editable && editorTool == DungeonEditorTool.CORRIDOR_DELETE;
        boolean showSelectionMarkers = editable && editorTool == DungeonEditorTool.SELECT && isSelected(corridor);
        if (!showDeleteMarkers && !showSelectionMarkers) {
            return;
        }
        Color markerColor = strokeColor(corridor);
        for (DoorSegment door : geometry.doors()) {
            if (isPreviewDoor(corridor.corridorId(), door.roomId())) {
                continue;
            }
            MarkerPoint marker = markerPoint(door, corridor.corridorId(), corridorIdsByDoorMarker, laneOrderBySegment, displayPath);
            CorridorEditInteractionController.DoorHandle handle = corridorDoorHandleForRoom(door.roomId());
            double radius = isSelected(handle) ? 5.5 : 4.5;
            gc.setFill(isSelected(handle) ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : markerColor);
            gc.fillOval(marker.x() + screenDeltaX(previewOffset) - radius, marker.y() + screenDeltaY(previewOffset) - radius, radius * 2, radius * 2);
            gc.setStroke(Color.rgb(18, 24, 28, 0.95));
            gc.setLineWidth(1.5);
            gc.strokeOval(marker.x() + screenDeltaX(previewOffset) - radius, marker.y() + screenDeltaY(previewOffset) - radius, radius * 2, radius * 2);
        }
        drawPreviewDoorMarker(gc, corridor, markerColor, corridorIdsByDoorMarker, laneOrderBySegment, displayPath, previewOffset);
    }

    private void drawCorridorWaypointMarkers(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry, Point2D previewOffset) {
        if (!editable || editorTool != DungeonEditorTool.SELECT || !isSelected(corridor)) {
            return;
        }
        gc.setLineWidth(1.5);
        for (Point2i waypoint : geometry.waypointCells()) {
            double centerX = previewScreenX(waypoint.x() + 0.5, previewOffset);
            double centerY = previewScreenY(waypoint.y() + 0.5, previewOffset);
            gc.setFill(strokeColor(corridor));
            gc.fillOval(centerX - 5, centerY - 5, 10, 10);
            gc.setStroke(Color.rgb(18, 24, 28, 0.95));
            gc.strokeOval(centerX - 5, centerY - 5, 10, 10);
        }
    }

    private void drawPreviewDoor(GraphicsContext gc, DungeonCorridor corridor) {
        CorridorEditInteractionController.DoorDragPreview preview = corridorDoorPreview();
        if (corridor == null
                || preview == null
                || preview.previewSegment() == null
                || previewCorridorDoorHandle == null
                || previewCorridorDoorHandle.corridorId() != corridor.corridorId()) {
            return;
        }
        CorridorEditInteractionController.DoorPreviewSegment segment = preview.previewSegment();
        Point2D previewOffset = corridorPreviewOffset(corridor);
        gc.strokeLine(
                previewScreenX(segment.startWorldX(), previewOffset),
                previewScreenY(segment.startWorldY(), previewOffset),
                previewScreenX(segment.endWorldX(), previewOffset),
                previewScreenY(segment.endWorldY(), previewOffset));
    }

    private void drawPreviewDoorMarker(
            GraphicsContext gc,
            DungeonCorridor corridor,
            Color markerColor,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            CorridorDisplayPath displayPath,
            Point2D previewOffset
    ) {
        CorridorEditInteractionController.DoorDragPreview preview = corridorDoorPreview();
        if (corridor == null
                || preview == null
                || preview.previewSegment() == null
                || previewCorridorDoorHandle == null
                || previewCorridorDoorHandle.corridorId() != corridor.corridorId()) {
            return;
        }
        MarkerPoint marker = markerPoint(
                preview,
                corridor.corridorId(),
                corridorIdsByDoorMarker,
                laneOrderBySegment,
                displayPath);
        double radius = isSelected(previewCorridorDoorHandle) ? 5.5 : 4.5;
        gc.setFill(isSelected(previewCorridorDoorHandle) ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : markerColor);
        gc.fillOval(marker.x() + screenDeltaX(previewOffset) - radius, marker.y() + screenDeltaY(previewOffset) - radius, radius * 2, radius * 2);
        gc.setStroke(Color.rgb(18, 24, 28, 0.95));
        gc.setLineWidth(1.5);
        gc.strokeOval(marker.x() + screenDeltaX(previewOffset) - radius, marker.y() + screenDeltaY(previewOffset) - radius, radius * 2, radius * 2);
    }

    private void strokeOutline(GraphicsContext gc, List<Point2i> outline) {
        Point2i start = null;
        Point2i previous = null;
        for (Point2i point : outline) {
            if (point.equals(new Point2i(Integer.MIN_VALUE, Integer.MIN_VALUE))) {
                if (start != null && previous != null) {
                    gc.strokeLine(camera.toScreenX(previous.x()), camera.toScreenY(previous.y()),
                            camera.toScreenX(start.x()), camera.toScreenY(start.y()));
                }
                start = null;
                previous = null;
                continue;
            }
            if (start == null) {
                start = point;
            } else {
                gc.strokeLine(
                        camera.toScreenX(previous.x()),
                        camera.toScreenY(previous.y()),
                        camera.toScreenX(point.x()),
                        camera.toScreenY(point.y()));
            }
            previous = point;
        }
        if (start != null && previous != null && !start.equals(previous)) {
            gc.strokeLine(camera.toScreenX(previous.x()), camera.toScreenY(previous.y()),
                    camera.toScreenX(start.x()), camera.toScreenY(start.y()));
        }
    }

    private void drawInvalidCorridor(GraphicsContext gc, DungeonCorridor corridor, CorridorGeometry geometry) {
        if (invalidCorridorLink(geometry) == null) {
            return;
        }
        gc.setStroke(isSelected(corridor)
                ? DungeonCanvasTheme.CORRIDOR_SELECTED
                : isHovered(corridor) ? DungeonCanvasTheme.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.9)
                : isActive(corridor) ? DungeonCanvasTheme.CORRIDOR_ACTIVE : DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(isSelected(corridor) ? 3 : isHovered(corridor) ? 2.5 : 2);
        gc.setLineDashes(8, 6);
        strokeInvalidCorridorLink(gc, geometry);
        gc.setLineDashes(null);
    }

    private boolean isComponentSelected(String componentId) {
        return false;
    }

    private boolean isComponentActive(String componentId) {
        return activeLocation instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent
                && java.util.Objects.equals(corridorComponent.componentId(), componentId);
    }

    private double distanceToGeometry(double screenX, double screenY, CorridorGeometry geometry, CorridorDisplayPath displayPath) {
        if (!geometry.routable()) {
            return distanceToInvalidCorridorLink(screenX, screenY, geometry);
        }
        double bestDistance = Double.POSITIVE_INFINITY;
        if (displayPath != null) {
            for (OffsetLine segment : displayPath.segments()) {
                bestDistance = Math.min(bestDistance, distanceToSegment(screenX, screenY, segment.x1(), segment.y1(), segment.x2(), segment.y2()));
            }
        }
        for (DoorSegment door : geometry.doors()) {
            bestDistance = Math.min(bestDistance, distanceToDoor(screenX, screenY, door));
        }
        return bestDistance;
    }

    private Color strokeColor(DungeonCorridor corridor) {
        if (isSelected(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED;
        }
        if (isHovered(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.9);
        }
        if (isActive(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_ACTIVE;
        }
        long corridorId = corridor.corridorId() == null ? 0L : corridor.corridorId();
        return GRAPH_GROUP_COLORS[(int) Math.floorMod(corridorId, GRAPH_GROUP_COLORS.length)];
    }

    private Point2D corridorPreviewOffset(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || layout == null) {
            return Point2D.ZERO;
        }
        if (hasClusterDragPreview()) {
            // Cluster drag previews already rebuild corridor geometry in previewLayout.
            // A second shared offset here would move corridor doors on untouched rooms as well.
            return Point2D.ZERO;
        }
        if (!hasSmoothClusterDragPreview()) {
            return Point2D.ZERO;
        }
        Point2D resolvedOffset = Point2D.ZERO;
        for (Long roomId : corridor.roomIds()) {
            DungeonRoom room = layout.roomById(roomId);
            Point2D roomOffset = room == null ? Point2D.ZERO : previewOffset(room.clusterId());
            resolvedOffset = mergeCorridorPreviewOffset(resolvedOffset, roomOffset);
        }
        for (var waypoint : corridor.waypoints()) {
            resolvedOffset = mergeCorridorPreviewOffset(resolvedOffset, previewOffset(waypoint.clusterId()));
        }
        for (var override : corridor.doorOverrides()) {
            resolvedOffset = mergeCorridorPreviewOffset(resolvedOffset, previewOffset(override.clusterId()));
        }
        return resolvedOffset;
    }

    private Point2D mergeCorridorPreviewOffset(Point2D current, Point2D candidate) {
        if (candidate == null || candidate.equals(Point2D.ZERO)) {
            return current;
        }
        if (current == null || current.equals(Point2D.ZERO) || current.equals(candidate)) {
            return candidate;
        }
        return current;
    }

    private double screenDeltaX(Point2D previewOffset) {
        return previewScreenX(0.0, previewOffset) - camera.toScreenX(0.0);
    }

    private double screenDeltaY(Point2D previewOffset) {
        return previewScreenY(0.0, previewOffset) - camera.toScreenY(0.0);
    }

    private Map<SegmentKey, List<Long>> corridorIdsBySegment() {
        Map<SegmentKey, List<Long>> result = new HashMap<>();
        if (corridorRenderDataForDisplay() == null || layout == null) {
            return result;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometry(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (GridSegment segment : geometry.segments()) {
                result.computeIfAbsent(SegmentKey.of(segment.from(), segment.to()), ignored -> new ArrayList<>()).add(corridor.corridorId());
            }
        }
        for (List<Long> corridorIds : result.values()) {
            corridorIds.sort(Long::compareTo);
        }
        return result;
    }

    private Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker() {
        Map<DoorMarkerKey, List<Long>> result = new HashMap<>();
        if (corridorRenderDataForDisplay() == null || layout == null) {
            return result;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometry(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                result.computeIfAbsent(DoorMarkerKey.of(door), ignored -> new ArrayList<>()).add(corridor.corridorId());
            }
        }
        for (List<Long> corridorIds : result.values()) {
            corridorIds.sort(Long::compareTo);
        }
        return result;
    }

    private Map<Long, CorridorDisplayPath> corridorDisplayPaths(Map<SegmentKey, List<Long>> laneOrderBySegment) {
        Map<Long, CorridorDisplayPath> result = new HashMap<>();
        if (layout == null || corridorRenderDataForDisplay() == null) {
            return result;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometry(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            List<OffsetLine> displaySegments = new ArrayList<>();
            // Graph paths intentionally mirror only real corridor geometry.
            // Do not synthesize connector lines between non-touching segments.
            for (GridSegment segment : geometry.segments()) {
                displaySegments.add(offsetLine(segment, corridor.corridorId(), laneOrderBySegment));
            }
            CorridorDisplayPath displayPath = new CorridorDisplayPath(List.copyOf(displaySegments));
            result.put(corridor.corridorId(), previewAdjustedDisplayPath(corridor, displayPath));
        }
        return result;
    }

    private CorridorDisplayPath previewAdjustedDisplayPath(DungeonCorridor corridor, CorridorDisplayPath displayPath) {
        if (corridor == null
                || displayPath == null
                || displayPath.segments().isEmpty()
                || previewCorridorDoorHandle == null
                || previewCorridorDoorDrag == null
                || previewCorridorDoorHandle.corridorId() != corridor.corridorId()) {
            return displayPath;
        }
        DoorSegment snapDoor = snapDoorSegment(previewCorridorDoorDrag);
        SegmentKey doorSegmentKey = nearestDisplaySegmentForDoor(snapDoor, displayPath);
        if (doorSegmentKey == null) {
            return displayPath;
        }
        CorridorEditInteractionController.DoorPreviewSegment previewSegment = previewCorridorDoorDrag.previewSegment();
        double previewX = camera.toScreenX(previewSegment.centerWorldX());
        double previewY = camera.toScreenY(previewSegment.centerWorldY());
        List<OffsetLine> adjustedSegments = new ArrayList<>(displayPath.segments());
        for (int index = 0; index < adjustedSegments.size(); index++) {
            OffsetLine segment = adjustedSegments.get(index);
            if (!doorSegmentKey.equals(segment.canonicalSegment())) {
                continue;
            }
            double startDistance = Math.hypot(segment.x1() - previewX, segment.y1() - previewY);
            double endDistance = Math.hypot(segment.x2() - previewX, segment.y2() - previewY);
            adjustedSegments.set(index, startDistance <= endDistance
                    ? new OffsetLine(previewX, previewY, segment.x2(), segment.y2(), segment.canonicalSegment())
                    : new OffsetLine(segment.x1(), segment.y1(), previewX, previewY, segment.canonicalSegment()));
            return new CorridorDisplayPath(adjustedSegments);
        }
        return displayPath;
    }

    private Map<SegmentKey, List<Long>> laneOrderBySegment(Map<SegmentKey, List<Long>> corridorIdsBySegment) {
        Map<SegmentKey, List<Long>> result = new HashMap<>();
        List<SharedSegmentChain> chains = sharedSegmentChains(corridorIdsBySegment);
        Map<Point2i, List<SharedSegmentChain>> chainsByPoint = new HashMap<>();
        for (SharedSegmentChain chain : chains) {
            for (SegmentKey segment : chain.segments()) {
                chainsByPoint.computeIfAbsent(segment.start(), ignored -> new ArrayList<>()).add(chain);
                chainsByPoint.computeIfAbsent(segment.end(), ignored -> new ArrayList<>()).add(chain);
            }
        }

        List<SharedSegmentChain> sortedChains = new ArrayList<>(chains);
        sortedChains.sort(Comparator
                .comparingInt((SharedSegmentChain chain) -> -chain.corridorIds().size())
                .thenComparing(chain -> chain.sortKey().x())
                .thenComparing(chain -> chain.sortKey().y()));

        Map<SharedSegmentChain, List<Long>> resolvedOrder = new LinkedHashMap<>();
        for (SharedSegmentChain chain : sortedChains) {
            List<Long> inheritedOrder = inheritedLaneOrder(chain, chainsByPoint, resolvedOrder);
            List<Long> laneOrder = inheritedOrder == null ? chain.corridorIds() : inheritedOrder;
            resolvedOrder.put(chain, laneOrder);
            for (SegmentKey segment : chain.segments()) {
                result.put(segment, laneOrder);
            }
        }

        for (Map.Entry<SegmentKey, List<Long>> entry : corridorIdsBySegment.entrySet()) {
            result.putIfAbsent(entry.getKey(), entry.getValue());
        }
        return result;
    }

    private List<SharedSegmentChain> sharedSegmentChains(Map<SegmentKey, List<Long>> corridorIdsBySegment) {
        Map<CorridorSetKey, List<SegmentKey>> segmentsByCorridorSet = new LinkedHashMap<>();
        for (Map.Entry<SegmentKey, List<Long>> entry : corridorIdsBySegment.entrySet()) {
            if (entry.getValue().size() < 2) {
                continue;
            }
            segmentsByCorridorSet.computeIfAbsent(new CorridorSetKey(entry.getValue()), ignored -> new ArrayList<>()).add(entry.getKey());
        }

        List<SharedSegmentChain> result = new ArrayList<>();
        for (Map.Entry<CorridorSetKey, List<SegmentKey>> entry : segmentsByCorridorSet.entrySet()) {
            Set<SegmentKey> unvisited = new LinkedHashSet<>(entry.getValue());
            while (!unvisited.isEmpty()) {
                SegmentKey seed = unvisited.iterator().next();
                Set<SegmentKey> component = new LinkedHashSet<>();
                List<SegmentKey> queue = new ArrayList<>();
                queue.add(seed);
                unvisited.remove(seed);
                for (int index = 0; index < queue.size(); index++) {
                    SegmentKey current = queue.get(index);
                    component.add(current);
                    List<SegmentKey> neighbors = touchingSegments(current, unvisited);
                    for (SegmentKey neighbor : neighbors) {
                        if (unvisited.remove(neighbor)) {
                            queue.add(neighbor);
                        }
                    }
                }
                Point2i sortKey = component.stream()
                        .flatMap(segment -> java.util.stream.Stream.of(segment.start(), segment.end()))
                        .min(Comparator.comparingInt(Point2i::x).thenComparingInt(Point2i::y))
                        .orElse(new Point2i(0, 0));
                result.add(new SharedSegmentChain(List.copyOf(entry.getKey().corridorIds()), Set.copyOf(component), sortKey));
            }
        }
        return result;
    }

    private List<SegmentKey> touchingSegments(SegmentKey anchor, Set<SegmentKey> candidates) {
        List<SegmentKey> result = new ArrayList<>();
        for (SegmentKey candidate : candidates) {
            if (anchor.touches(candidate)) {
                result.add(candidate);
            }
        }
        return result;
    }

    private List<Long> inheritedLaneOrder(
            SharedSegmentChain chain,
            Map<Point2i, List<SharedSegmentChain>> chainsByPoint,
            Map<SharedSegmentChain, List<Long>> resolvedOrder
    ) {
        List<Long> best = null;
        int bestSourceSize = -1;
        for (SegmentKey segment : chain.segments()) {
            for (Point2i point : List.of(segment.start(), segment.end())) {
                for (SharedSegmentChain neighbor : chainsByPoint.getOrDefault(point, List.of())) {
                    if (neighbor == chain) {
                        continue;
                    }
                    List<Long> order = resolvedOrder.get(neighbor);
                    if (order == null || !order.containsAll(chain.corridorIds())) {
                        continue;
                    }
                    List<Long> filtered = order.stream()
                            .filter(chain.corridorIds()::contains)
                            .toList();
                    if (filtered.size() != chain.corridorIds().size()) {
                        continue;
                    }
                    if (order.size() > bestSourceSize || best == null) {
                        best = filtered;
                        bestSourceSize = order.size();
                    }
                }
            }
        }
        return best;
    }

    private OffsetLine offsetLine(GridSegment segment, Long corridorId, Map<SegmentKey, List<Long>> laneOrderBySegment) {
        SegmentKey canonicalSegment = SegmentKey.of(segment.from(), segment.to());
        double x1 = camera.toScreenX(segment.from().x() + 0.5);
        double y1 = camera.toScreenY(segment.from().y() + 0.5);
        double x2 = camera.toScreenX(segment.to().x() + 0.5);
        double y2 = camera.toScreenY(segment.to().y() + 0.5);
        List<Long> corridorIds = laneOrderBySegment.getOrDefault(canonicalSegment, List.of());
        if (corridorIds.size() < 2 || corridorId == null) {
            return new OffsetLine(x1, y1, x2, y2, canonicalSegment);
        }
        int index = corridorIds.indexOf(corridorId);
        if (index < 0) {
            return new OffsetLine(x1, y1, x2, y2, canonicalSegment);
        }
        double centerOffset = (index - (corridorIds.size() - 1) / 2.0) * laneSpacing(corridorIds.size());
        double canonicalX1 = camera.toScreenX(canonicalSegment.start().x() + 0.5);
        double canonicalY1 = camera.toScreenY(canonicalSegment.start().y() + 0.5);
        double canonicalX2 = camera.toScreenX(canonicalSegment.end().x() + 0.5);
        double canonicalY2 = camera.toScreenY(canonicalSegment.end().y() + 0.5);
        double dx = canonicalX2 - canonicalX1;
        double dy = canonicalY2 - canonicalY1;
        double length = Math.hypot(dx, dy);
        if (length == 0) {
            return new OffsetLine(x1, y1, x2, y2, canonicalSegment);
        }
        double offsetX = -dy / length * centerOffset;
        double offsetY = dx / length * centerOffset;
        return new OffsetLine(x1 + offsetX, y1 + offsetY, x2 + offsetX, y2 + offsetY, canonicalSegment);
    }

    private double laneSpacing(int laneCount) {
        if (laneCount <= 1) {
            return SHARED_SEGMENT_OFFSET;
        }
        return Math.min(SHARED_SEGMENT_OFFSET + (laneCount - 2) * 1.5, MAX_SHARED_OFFSET / Math.max(1.0, (laneCount - 1) / 2.0));
    }

    private MarkerPoint markerPoint(
            DoorSegment door,
            Long corridorId,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            CorridorDisplayPath displayPath
    ) {
        double centerX = (camera.toScreenX(door.start().x()) + camera.toScreenX(door.end().x())) / 2.0;
        double centerY = (camera.toScreenY(door.start().y()) + camera.toScreenY(door.end().y())) / 2.0;
        List<Long> corridorIds = laneOrderForDoor(door, corridorIdsByDoorMarker, laneOrderBySegment, displayPath);
        if (corridorIds.size() < 2 || corridorId == null) {
            return new MarkerPoint(centerX, centerY);
        }
        int index = corridorIds.indexOf(corridorId);
        if (index < 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double tangentOffset = (index - (corridorIds.size() - 1) / 2.0) * 10.0;
        double doorDx = camera.toScreenX(door.end().x()) - camera.toScreenX(door.start().x());
        double doorDy = camera.toScreenY(door.end().y()) - camera.toScreenY(door.start().y());
        double doorLength = Math.hypot(doorDx, doorDy);
        if (doorLength == 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double offsetX = doorDx / doorLength * tangentOffset;
        double offsetY = doorDy / doorLength * tangentOffset;
        return new MarkerPoint(centerX + offsetX, centerY + offsetY);
    }

    private MarkerPoint markerPoint(
            CorridorEditInteractionController.DoorDragPreview preview,
            Long corridorId,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            CorridorDisplayPath displayPath
    ) {
        CorridorEditInteractionController.DoorPreviewSegment segment = preview.previewSegment();
        double centerX = camera.toScreenX(segment.centerWorldX());
        double centerY = camera.toScreenY(segment.centerWorldY());
        DoorSegment snapDoor = snapDoorSegment(preview);
        List<Long> corridorIds = laneOrderForDoor(snapDoor, corridorIdsByDoorMarker, laneOrderBySegment, displayPath);
        if (corridorIds.size() < 2 || corridorId == null) {
            return new MarkerPoint(centerX, centerY);
        }
        int index = corridorIds.indexOf(corridorId);
        if (index < 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double tangentOffset = (index - (corridorIds.size() - 1) / 2.0) * 10.0;
        double doorDx = camera.toScreenX(segment.endWorldX()) - camera.toScreenX(segment.startWorldX());
        double doorDy = camera.toScreenY(segment.endWorldY()) - camera.toScreenY(segment.startWorldY());
        double doorLength = Math.hypot(doorDx, doorDy);
        if (doorLength == 0) {
            return new MarkerPoint(centerX, centerY);
        }
        double offsetX = doorDx / doorLength * tangentOffset;
        double offsetY = doorDy / doorLength * tangentOffset;
        return new MarkerPoint(centerX + offsetX, centerY + offsetY);
    }

    private List<Long> laneOrderForDoor(
            DoorSegment door,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            CorridorDisplayPath displayPath
    ) {
        List<Long> fallback = corridorIdsByDoorMarker.getOrDefault(DoorMarkerKey.of(door), List.of());
        if (fallback.size() < 2) {
            return fallback;
        }
        SegmentKey nearestSegment = nearestDisplaySegmentForDoor(door, displayPath);
        if (nearestSegment != null) {
            List<Long> laneOrder = laneOrderBySegment.getOrDefault(nearestSegment, List.of());
            List<Long> filtered = laneOrder.stream()
                    .filter(fallback::contains)
                    .toList();
            if (filtered.size() == fallback.size()) {
                return filtered;
            }
        }
        return fallback;
    }

    private DoorSegment snapDoorSegment(CorridorEditInteractionController.DoorDragPreview preview) {
        CorridorEditInteractionController.DoorMoveTarget target = preview.snapTarget();
        EdgeVertices vertices = edgeVertices(target.roomCell(), target.direction());
        return new DoorSegment(vertices.start(), vertices.end(), target.roomId(), target.roomCell());
    }

    private SegmentKey nearestDisplaySegmentForDoor(DoorSegment door, CorridorDisplayPath displayPath) {
        if (displayPath == null || displayPath.segments().isEmpty()) {
            return null;
        }
        Point2i outsideCell = outsideCellForDoor(door);
        SegmentKey bestSegment = null;
        int bestDistance = Integer.MAX_VALUE;
        for (OffsetLine segment : displayPath.segments()) {
            SegmentKey canonical = segment.canonicalSegment();
            if (canonical == null) {
                continue;
            }
            int distance = Math.min(manhattan(outsideCell, canonical.start()), manhattan(outsideCell, canonical.end()));
            if (distance < bestDistance) {
                bestDistance = distance;
                bestSegment = canonical;
            }
        }
        return bestDistance <= 1 ? bestSegment : null;
    }

    private CorridorGeometry corridorGeometry(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || corridorRenderDataForDisplay() == null) {
            return null;
        }
        return corridorGeometryForDisplay(corridor);
    }

    @Override
    protected CorridorGeometry corridorGeometryForSelection(DungeonCorridor corridor) {
        return corridorGeometry(corridor);
    }

    private Point2i outsideCellForDoor(DoorSegment door) {
        Point2i roomCell = door.roomCell();
        if (door.start().x() == door.end().x()) {
            return roomCell.x() < door.start().x()
                    ? new Point2i(roomCell.x() + 1, roomCell.y())
                    : new Point2i(roomCell.x() - 1, roomCell.y());
        }
        return roomCell.y() < door.start().y()
                ? new Point2i(roomCell.x(), roomCell.y() + 1)
                : new Point2i(roomCell.x(), roomCell.y() - 1);
    }

    private int manhattan(Point2i a, Point2i b) {
        return Math.abs(a.x() - b.x()) + Math.abs(a.y() - b.y());
    }

    private int segmentIndexForKey(CorridorGeometry geometry, SegmentKey targetKey) {
        if (geometry == null || targetKey == null) {
            return -1;
        }
        for (int index = 0; index < geometry.segments().size(); index++) {
            GridSegment segment = geometry.segments().get(index);
            if (SegmentKey.of(segment.from(), segment.to()).equals(targetKey)) {
                return index;
            }
        }
        return -1;
    }

    private record SegmentKey(Point2i start, Point2i end) {
        private static SegmentKey of(Point2i a, Point2i b) {
            if (a.x() < b.x() || (a.x() == b.x() && a.y() <= b.y())) {
                return new SegmentKey(a, b);
            }
            return new SegmentKey(b, a);
        }

        private boolean touches(SegmentKey other) {
            return start.equals(other.start())
                    || start.equals(other.end())
                    || end.equals(other.start())
                    || end.equals(other.end());
        }
    }

    private record OffsetLine(double x1, double y1, double x2, double y2, SegmentKey canonicalSegment) {
    }

    private record DoorMarkerKey(Point2i start, Point2i end, long roomId) {
        private static DoorMarkerKey of(DoorSegment door) {
            if (door.start().x() < door.end().x() || (door.start().x() == door.end().x() && door.start().y() <= door.end().y())) {
                return new DoorMarkerKey(door.start(), door.end(), door.roomId());
            }
            return new DoorMarkerKey(door.end(), door.start(), door.roomId());
        }
    }

    private record MarkerPoint(double x, double y) {
    }

    private record CorridorSetKey(List<Long> corridorIds) {
        private CorridorSetKey {
            corridorIds = List.copyOf(corridorIds);
        }
    }

    private record SharedSegmentChain(List<Long> corridorIds, Set<SegmentKey> segments, Point2i sortKey) {
        private SharedSegmentChain {
            corridorIds = List.copyOf(corridorIds);
            segments = Set.copyOf(segments);
            sortKey = Objects.requireNonNull(sortKey, "sortKey");
        }
    }

    private record CorridorDisplayPath(List<OffsetLine> segments) {
        private CorridorDisplayPath {
            segments = List.copyOf(segments);
        }
    }


    private record CorridorRenderState(
            Map<SegmentKey, List<Long>> laneOrderBySegment,
            Map<DoorMarkerKey, List<Long>> corridorIdsByDoorMarker,
            Map<Long, CorridorDisplayPath> displayPaths
    ) {
    }
}
