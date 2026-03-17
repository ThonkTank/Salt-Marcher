package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonClusterEdgeRules;
import features.world.dungeonmap.model.DungeonClusterVertexRef;
import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.DungeonClusterGeometry;
import features.world.dungeonmap.model.DoorSegment;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;

import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;

public final class DungeonGridPane extends AbstractDungeonPane {

    public DungeonGridPane(DungeonCanvasCamera camera) {
        super(camera);
    }

    public WallPathInteractionController wallPathController() {
        return super.wallPathInteractionController();
    }

    @Override
    protected void renderContent(GraphicsContext gc) {
        Set<CorridorRenderKeys.CorridorSegmentKey> openSegments = allDoorSegments();
        Set<Long> encodedOpenSegments = encodeSegments(openSegments);
        drawGrid(gc);
        drawCorridors(gc, openSegments, encodedOpenSegments);

        for (DungeonRoomCluster cluster : layout.clusters()) {
            Set<Point2i> cells = clusterCellsFor(cluster);
            boolean active = isActive(cluster);
            boolean selected = isSelected(cluster);
            drawRoom(gc, cells, previewOffset(cluster.clusterId()), active, selected, openSegments, encodedOpenSegments);
            drawClusterAndRoomAnchors(gc, cluster);
        }
        drawClusterEdges(gc);
        drawWallPathPreview(gc);
        drawDoors(gc);
        drawCorridorEditHandles(gc);

        drawSelectionPreview(gc);
        drawPaintPreview(gc);
    }

    private void drawGrid(GraphicsContext gc) {
        gc.setStroke(DungeonCanvasTheme.GRID_LINE);
        gc.setLineWidth(1);
        for (int x = camera.visibleMinWorldX(); x <= camera.visibleMaxWorldX() + 1; x++) {
            double screenX = camera.toScreenX(x);
            gc.strokeLine(screenX, 0, screenX, canvas.getHeight());
        }
        for (int y = camera.visibleMinWorldY(); y <= camera.visibleMaxWorldY() + 1; y++) {
            double screenY = camera.toScreenY(y);
            gc.strokeLine(0, screenY, canvas.getWidth(), screenY);
        }
    }

    @Override
    protected DungeonRoomCluster findClusterAt(double screenX, double screenY) {
        Point2i cell = worldPointAt(screenX, screenY);
        if (!previewClusterCenters.isEmpty()) {
            return previewClusterAtCell(cell);
        }
        if (renderData != null) {
            DungeonRoomCluster cluster = renderData.clusterAtCell(cell);
            if (cluster != null) {
                return cluster;
            }
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            if (clusterCellsFor(cluster).contains(cell)) {
                return cluster;
            }
        }
        return null;
    }

    @Override
    protected DungeonRoom findRoomAt(double screenX, double screenY) {
        Point2i cell = worldPointAt(screenX, screenY);
        if (!previewClusterCenters.isEmpty()) {
            return previewRoomAtCell(cell);
        }
        if (renderData != null) {
            DungeonRoom room = renderData.roomAtCell(cell);
            if (room != null) {
                return room;
            }
        }
        for (DungeonRoom room : layout.rooms()) {
            if (roomCellsFor(room).contains(cell)) {
                return room;
            }
        }
        return null;
    }

    @Override
    protected DungeonCorridor findCorridorAt(double screenX, double screenY) {
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        if (layout == null || corridorRenderData == null) {
            return null;
        }
        Point2i cell = worldPointAt(screenX, screenY);
        if (previewClusterCenters.isEmpty()) {
            List<Long> corridorIds = corridorRenderData.corridorIdsAtCell(cell);
            if (!corridorIds.isEmpty()) {
                return layout.corridorById(corridorIds.get(0));
            }
        }
        DungeonCorridor bestCorridor = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null) {
                continue;
            }
            if (!geometry.routable()) {
                double distance = distanceToInvalidCorridorLink(screenX, screenY, geometry);
                if (distance < bestDistance && distance <= 10) {
                    bestDistance = distance;
                    bestCorridor = corridor;
                }
                continue;
            }
            if (geometry.cells().contains(cell)) {
                return corridor;
            }
            for (DoorSegment door : geometry.doors()) {
                double distance = distanceToDoor(screenX, screenY, door);
                if (distance < bestDistance && distance <= 10) {
                    bestDistance = distance;
                    bestCorridor = corridor;
                }
            }
        }
        return bestCorridor;
    }

    @Override
    protected CorridorDoorHit findCorridorDoorHitAt(double screenX, double screenY) {
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        if (layout == null || corridorRenderData == null) {
            return null;
        }
        DoorAggregateHit bestHit = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                double doorDistance = distanceToDoor(screenX, screenY, door);
                if (doorDistance > 10) {
                    continue;
                }
                double roomDistance = distanceToRoomCell(screenX, screenY, door.roomCell());
                double combinedDistance = doorDistance * 10 + roomDistance;
                if (combinedDistance < bestDistance) {
                    bestDistance = combinedDistance;
                    List<Long> corridorIds = corridorRenderData.corridorIdsForDoorFromRoom(door);
                    bestHit = new DoorAggregateHit(corridorIds, door.roomId());
                }
            }
        }
        return bestHit == null ? null : new CorridorDoorHit(bestHit.corridorIds(), bestHit.roomId());
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
        CorridorEditInteractionController.DoorHandle best = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DoorSegment door : context.geometry().doors()) {
            double distance = distanceToDoor(screenX, screenY, door);
            if (distance <= 12 && distance < bestDistance) {
                bestDistance = distance;
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
            double distance = distanceToRoomCell(screenX, screenY, waypoint);
            if (distance <= 12 && distance < bestDistance) {
                bestDistance = distance;
                best = new CorridorEditInteractionController.WaypointHandle(context.corridor().corridorId(), index);
            }
        }
        return best;
    }

    @Override
    protected int corridorSegmentIndexAt(double screenX, double screenY) {
        CorridorSelectionContext context = selectedCorridorContext();
        if (context == null || context.geometry().segments().isEmpty()) {
            return -1;
        }
        int bestSegmentIndex = -1;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (int index = 0; index < context.geometry().segments().size(); index++) {
            features.world.dungeonmap.model.GridSegment segment = context.geometry().segments().get(index);
            double distance = distanceToSegment(screenX, screenY, segment.from(), segment.to());
            if (distance <= 10 && distance < bestDistance) {
                bestDistance = distance;
                bestSegmentIndex = index;
            }
        }
        return bestSegmentIndex;
    }

    @Override
    protected Point2i worldPointAt(double screenX, double screenY) {
        int x = (int) Math.floor(camera.toWorldX(screenX));
        int y = (int) Math.floor(camera.toWorldY(screenY));
        return new Point2i(x, y);
    }

    @Override
    protected EditorSurface surface() {
        return EditorSurface.GRID;
    }

    @Override
    protected DungeonClusterEdgeRef findClusterEdgeAt(double screenX, double screenY) {
        if (layout == null || renderData == null) {
            return null;
        }
        double worldX = camera.toWorldX(screenX);
        double worldY = camera.toWorldY(screenY);
        Point2i cell = new Point2i((int) Math.floor(worldX), (int) Math.floor(worldY));
        DungeonRoomCluster cluster = findClusterAt(screenX, screenY);
        if (cluster == null) {
            return null;
        }
        double localX = worldX - cell.x();
        double localY = worldY - cell.y();
        double left = localX;
        double right = 1 - localX;
        double top = localY;
        double bottom = 1 - localY;
        double best = left;
        features.world.dungeonmap.model.DungeonRoomCluster.EdgeDirection direction = features.world.dungeonmap.model.DungeonRoomCluster.EdgeDirection.WEST;
        if (right < best) {
            best = right;
            direction = features.world.dungeonmap.model.DungeonRoomCluster.EdgeDirection.EAST;
        }
        if (top < best) {
            best = top;
            direction = features.world.dungeonmap.model.DungeonRoomCluster.EdgeDirection.NORTH;
        }
        if (bottom < best) {
            direction = features.world.dungeonmap.model.DungeonRoomCluster.EdgeDirection.SOUTH;
        }
        return new DungeonClusterEdgeRef(cluster.clusterId(), cell, direction);
    }

    @Override
    protected DungeonClusterVertexRef findClusterVertexAt(double screenX, double screenY) {
        List<DungeonClusterVertexRef> candidates = findClusterVerticesNear(screenX, screenY);
        return candidates.isEmpty() ? null : candidates.getFirst();
    }

    @Override
    protected List<DungeonClusterVertexRef> findClusterVerticesNear(double screenX, double screenY) {
        if (layout == null) {
            return List.of();
        }
        NearbyVertexSearch search = nearbyVertexSearch(screenX, screenY);
        DungeonRoomCluster hoveredCluster = findClusterAt(screenX, screenY);
        List<VertexCandidate> candidates = new ArrayList<>();
        Set<DungeonClusterVertexRef> seen = new LinkedHashSet<>();
        for (int vertexY = search.minVertexY(); vertexY <= search.maxVertexY(); vertexY++) {
            for (int vertexX = search.minVertexX(); vertexX <= search.maxVertexX(); vertexX++) {
                Point2i vertex = new Point2i(vertexX, vertexY);
                double distanceSquared = squaredDistance(search.worldX(), search.worldY(), vertexX, vertexY);
                if (distanceSquared > search.maxDistanceSquared()) {
                    continue;
                }
                if (hoveredCluster != null && clusterTouchesVertex(hoveredCluster, vertex)) {
                    DungeonClusterVertexRef ref = new DungeonClusterVertexRef(hoveredCluster.clusterId(), vertex);
                    if (seen.add(ref)) {
                        candidates.add(new VertexCandidate(ref, true, distanceSquared));
                    }
                }
                for (Long clusterId : clusterIdsTouchingVertex(vertex)) {
                    DungeonClusterVertexRef ref = new DungeonClusterVertexRef(clusterId, vertex);
                    if (seen.add(ref)) {
                        candidates.add(new VertexCandidate(ref, hoveredCluster != null && hoveredCluster.clusterId().equals(clusterId), distanceSquared));
                    }
                }
            }
        }
        candidates.sort((left, right) -> {
            if (left.hoveredCluster() != right.hoveredCluster()) {
                return left.hoveredCluster() ? -1 : 1;
            }
            int distanceComparison = Double.compare(left.distanceSquared(), right.distanceSquared());
            if (distanceComparison != 0) {
                return distanceComparison;
            }
            return Long.compare(left.ref().clusterId(), right.ref().clusterId());
        });
        return candidates.stream()
                .map(VertexCandidate::ref)
                .toList();
    }

    @Override
    protected DungeonClusterVertexRef findClusterVertexNear(long clusterId, double screenX, double screenY) {
        if (layout == null) {
            return null;
        }
        DungeonRoomCluster cluster = layout.clusterById(clusterId);
        if (cluster == null) {
            return null;
        }
        NearbyVertexSearch search = nearbyVertexSearch(screenX, screenY);
        DungeonClusterVertexRef best = null;
        double bestDistanceSquared = Double.POSITIVE_INFINITY;
        for (int vertexY = search.minVertexY(); vertexY <= search.maxVertexY(); vertexY++) {
            for (int vertexX = search.minVertexX(); vertexX <= search.maxVertexX(); vertexX++) {
                double distanceSquared = squaredDistance(search.worldX(), search.worldY(), vertexX, vertexY);
                if (distanceSquared > search.maxDistanceSquared()) {
                    continue;
                }
                Point2i vertex = new Point2i(vertexX, vertexY);
                if (!clusterTouchesVertex(cluster, vertex)) {
                    continue;
                }
                if (distanceSquared < bestDistanceSquared) {
                    bestDistanceSquared = distanceSquared;
                    best = new DungeonClusterVertexRef(clusterId, vertex);
                }
            }
        }
        return best;
    }

    @Override
    protected DungeonRoomCluster findClusterInSelection(Point2i startInclusive, Point2i endInclusive) {
        int minX = Math.min(startInclusive.x(), endInclusive.x());
        int maxX = Math.max(startInclusive.x(), endInclusive.x());
        int minY = Math.min(startInclusive.y(), endInclusive.y());
        int maxY = Math.max(startInclusive.y(), endInclusive.y());

        DungeonRoomCluster bestCluster = null;
        int bestOverlap = 0;
        for (DungeonRoomCluster cluster : layout.clusters()) {
            Set<Point2i> clusterCells = clusterCellsFor(cluster);
            if (clusterCells.isEmpty()) {
                continue;
            }
            int overlap = 0;
            for (Point2i cell : clusterCells) {
                if (cell.x() >= minX && cell.x() <= maxX && cell.y() >= minY && cell.y() <= maxY) {
                    overlap++;
                }
            }
            if (overlap > bestOverlap || (overlap == bestOverlap && overlap > 0
                    && (bestCluster == null || cluster.clusterId() < bestCluster.clusterId()))) {
                bestCluster = cluster;
                bestOverlap = overlap;
            }
        }
        return bestCluster;
    }

    private void drawCorridors(
            GraphicsContext gc,
            Set<CorridorRenderKeys.CorridorSegmentKey> openSegments,
            Set<Long> encodedOpenSegments
    ) {
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        if (corridorRenderData == null) {
            return;
        }
        Set<Point2i> allCorridorCells = displayedCorridorCells(corridorRenderData);
        if (allCorridorCells.isEmpty()) {
            return;
        }
        drawRegion(gc, allCorridorCells, Point2D.ZERO, DungeonCanvasTheme.CORRIDOR, DungeonCanvasTheme.ROOM_STROKE, 2, openSegments,
                encodedOpenSegments);

        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable() || geometry.cells().isEmpty()) {
                continue;
            }
            gc.setFill(fillColor(corridor));
            Point2D previewOffset = corridorPreviewOffset(corridor);
            for (Point2i cell : geometry.cells()) {
                double x = previewScreenX(cell.x(), previewOffset);
                double y = previewScreenY(cell.y(), previewOffset);
                double width = previewScreenX(cell.x() + 1, previewOffset) - x;
                double height = previewScreenY(cell.y() + 1, previewOffset) - y;
                gc.fillRect(x, y, width, height);
            }
        }
    }

    private void drawDoors(GraphicsContext gc) {
        if (corridorRenderDataForDisplay() == null) {
            return;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            gc.setStroke(doorColor(corridor));
            gc.setLineWidth(isSelected(corridor) ? 7 : isHovered(corridor) ? 6.5 : 6);
            for (DoorSegment door : geometry.doors()) {
                if (isPreviewDoor(corridor.corridorId(), door.roomId())) {
                    continue;
                }
                Point2D previewOffset = doorPreviewOffset(door);
                gc.strokeLine(
                        previewScreenX(door.start().x(), previewOffset),
                        previewScreenY(door.start().y(), previewOffset),
                        previewScreenX(door.end().x(), previewOffset),
                        previewScreenY(door.end().y(), previewOffset));
            }
        }
        drawPreviewDoor(gc);
    }

    private void drawCorridorEditHandles(GraphicsContext gc) {
        CorridorSelectionContext context = selectedCorridorContext();
        CorridorEditInteractionController.PressMode pressMode = corridorPressMode();
        if (!editable
                || context == null
                || editorTool != DungeonEditorTool.SELECT
                || pressMode == CorridorEditInteractionController.PressMode.DEFAULT) {
            return;
        }
        gc.setStroke(pressMode == CorridorEditInteractionController.PressMode.REMOVE_WAYPOINT
                ? DungeonCanvasTheme.ROOM_SELECTED_STROKE
                : DungeonCanvasTheme.CORRIDOR_SELECTED);
        gc.setLineWidth(4);
        Point2D previewOffset = corridorPreviewOffset(context.corridor());
        for (features.world.dungeonmap.model.GridSegment segment : context.geometry().segments()) {
            gc.strokeLine(
                    previewScreenX(segment.from().x() + 0.5, previewOffset),
                    previewScreenY(segment.from().y() + 0.5, previewOffset),
                    previewScreenX(segment.to().x() + 0.5, previewOffset),
                    previewScreenY(segment.to().y() + 0.5, previewOffset));
        }
        gc.setLineWidth(2);
        for (DoorSegment door : context.geometry().doors()) {
            double centerX = (previewScreenX(door.start().x(), previewOffset) + previewScreenX(door.end().x(), previewOffset)) / 2.0;
            double centerY = (previewScreenY(door.start().y(), previewOffset) + previewScreenY(door.end().y(), previewOffset)) / 2.0;
            CorridorEditInteractionController.DoorHandle handle = corridorDoorHandleForRoom(door.roomId());
            double radius = isSelected(handle) ? 6 : 5;
            gc.setFill(isSelected(handle) ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.DOOR_SELECTED);
            gc.fillOval(centerX - radius, centerY - radius, radius * 2, radius * 2);
            gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
            gc.strokeOval(centerX - radius, centerY - radius, radius * 2, radius * 2);
        }
        for (Point2i waypoint : context.geometry().waypointCells()) {
            double centerX = previewScreenX(waypoint.x() + 0.5, previewOffset);
            double centerY = previewScreenY(waypoint.y() + 0.5, previewOffset);
            gc.setFill(DungeonCanvasTheme.CORRIDOR_SELECTED);
            gc.fillOval(centerX - 5.5, centerY - 5.5, 11, 11);
            gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
            gc.strokeOval(centerX - 5.5, centerY - 5.5, 11, 11);
        }
    }

    private void drawClusterEdges(GraphicsContext gc) {
        if (layout == null) {
            return;
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            for (DungeonRoomCluster.EdgeOverride edge : cluster.edgeOverrides()) {
                Point2i start = edgeStart(cluster, edge);
                Point2i end = edgeEnd(cluster, edge);
                if (DungeonClusterEdgeRules.providesWall(edge.type())) {
                    gc.setStroke(DungeonCanvasTheme.ROOM_SELECTED_STROKE);
                    gc.setLineWidth(4);
                    gc.strokeLine(
                            previewScreenX(start.x(), cluster.clusterId()),
                            previewScreenY(start.y(), cluster.clusterId()),
                            previewScreenX(end.x(), cluster.clusterId()),
                            previewScreenY(end.y(), cluster.clusterId()));
                }
                if (edge.type() == DungeonRoomCluster.EdgeType.DOOR) {
                    gc.setStroke(DungeonCanvasTheme.DOOR);
                    gc.setLineWidth(6);
                    gc.strokeLine(
                            previewScreenX(start.x(), cluster.clusterId()),
                            previewScreenY(start.y(), cluster.clusterId()),
                            previewScreenX(end.x(), cluster.clusterId()),
                            previewScreenY(end.y(), cluster.clusterId()));
                }
            }
        }
    }

    private void drawClusterAndRoomAnchors(GraphicsContext gc, DungeonRoomCluster cluster) {
        ClusterAnchorLayout anchorLayout = ClusterAnchorLayout.forCluster(layout, cluster, this::previewCenter, this::previewCenter);
        ClusterAnchorLayout.AnchorPosition clusterAnchor = clusterAnchorPosition(cluster, anchorLayout);
        gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
        gc.fillOval(clusterAnchor.x() - 4.5, clusterAnchor.y() - 4.5, 9, 9);
        gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(1.5);
        gc.strokeOval(clusterAnchor.x() - 4.5, clusterAnchor.y() - 4.5, 9, 9);

        for (DungeonRoom room : layout.roomsForCluster(cluster.clusterId())) {
            ClusterAnchorLayout.AnchorPosition roomAnchor = roomAnchorPosition(anchorLayout, room);
            gc.setFill(DungeonCanvasTheme.GRAPH_NODE_FILL);
            gc.fillOval(roomAnchor.x() - 3.5, roomAnchor.y() - 3.5, 7, 7);
            gc.setStroke(DungeonCanvasTheme.ROOM_SELECTED_STROKE);
            gc.setLineWidth(1.2);
            gc.strokeOval(roomAnchor.x() - 3.5, roomAnchor.y() - 3.5, 7, 7);
            DungeonCanvasTheme.drawCenteredLabel(gc, room.name(), roomAnchor.x(), roomAnchor.y());
        }
    }

    private ClusterAnchorLayout.AnchorPosition clusterAnchorPosition(DungeonRoomCluster cluster, ClusterAnchorLayout anchorLayout) {
        Point2i center = anchorLayout.clusterCenter();
        double x = previewScreenX(center.x() + 0.5, cluster.clusterId());
        double y = previewScreenY(center.y() + 0.5, cluster.clusterId());
        return new ClusterAnchorLayout.AnchorPosition(x, anchorLayout.clusterOverlapsRoom() ? y - 8 : y);
    }

    private ClusterAnchorLayout.AnchorPosition roomAnchorPosition(ClusterAnchorLayout anchorLayout, DungeonRoom room) {
        ClusterAnchorLayout.RoomAnchorGroup roomGroup = anchorLayout.roomGroup(room);
        Point2i center = roomGroup.center();
        double x = previewScreenX(center.x() + 0.5, room.clusterId());
        double y = previewScreenY(center.y() + 0.5, room.clusterId());
        double stackOffset = roomGroup.count() <= 1 ? 0 : (roomGroup.index() - (roomGroup.count() - 1) / 2.0) * 11.0;
        if (roomGroup.overlapsCluster(anchorLayout.clusterCenter())) {
            stackOffset += 10;
        }
        return new ClusterAnchorLayout.AnchorPosition(x, y + stackOffset);
    }

    private void drawWallPathPreview(GraphicsContext gc) {
        if (!editorTool.isWallTool()) {
            return;
        }
        if (wallPathInteractionController().activeAnchor() != null) {
            drawWallAnchor(gc, wallPathInteractionController().activeAnchor(), DungeonCanvasTheme.ROOM_PREVIEW_STROKE);
        }
        if (wallPathInteractionController().previewPath().isEmpty()) {
            return;
        }
        gc.setStroke(DungeonCanvasTheme.ROOM_PREVIEW_STROKE);
        gc.setLineWidth(4);
        for (DungeonClusterEdgeRef edgeRef : wallPathInteractionController().previewPath()) {
            EdgeVertices vertices = edgeVertices(edgeRef);
            if (vertices == null) {
                continue;
            }
            gc.strokeLine(
                    camera.toScreenX(vertices.start().x()),
                    camera.toScreenY(vertices.start().y()),
                    camera.toScreenX(vertices.end().x()),
                    camera.toScreenY(vertices.end().y()));
        }
    }

    private void drawWallAnchor(GraphicsContext gc, DungeonClusterVertexRef vertexRef, javafx.scene.paint.Color color) {
        if (vertexRef == null || vertexRef.point() == null) {
            return;
        }
        double centerX = camera.toScreenX(vertexRef.point().x());
        double centerY = camera.toScreenY(vertexRef.point().y());
        gc.setFill(color);
        gc.fillOval(centerX - 4.5, centerY - 4.5, 9, 9);
        gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(1.5);
        gc.strokeOval(centerX - 4.5, centerY - 4.5, 9, 9);
    }

    private boolean clusterTouchesVertex(DungeonRoomCluster cluster, Point2i vertex) {
        return cluster != null
                && cluster.clusterId() != null
                && vertex != null
                && clusterIdsTouchingVertex(vertex).contains(cluster.clusterId());
    }

    private List<Long> clusterIdsTouchingVertex(Point2i vertex) {
        if (vertex == null || layout == null) {
            return List.of();
        }
        if (!hasClusterDragPreview() && renderData != null) {
            return renderData.clusterIdsAtVertex(vertex);
        }
        List<Long> clusterIds = new ArrayList<>();
        for (DungeonRoomCluster cluster : layout.clusters()) {
            if (cluster != null && cluster.clusterId() != null && clusterTouchesVertexPreviewAware(cluster, vertex)) {
                clusterIds.add(cluster.clusterId());
            }
        }
        return clusterIds;
    }

    private boolean clusterTouchesVertexPreviewAware(DungeonRoomCluster cluster, Point2i vertex) {
        Set<Point2i> clusterCells = clusterCellsFor(cluster);
        return clusterCells.contains(new Point2i(vertex.x(), vertex.y()))
                || clusterCells.contains(new Point2i(vertex.x() - 1, vertex.y()))
                || clusterCells.contains(new Point2i(vertex.x(), vertex.y() - 1))
                || clusterCells.contains(new Point2i(vertex.x() - 1, vertex.y() - 1));
    }

    private EdgeVertices edgeVertices(DungeonClusterEdgeRef edgeRef) {
        if (edgeRef == null || edgeRef.cell() == null || edgeRef.direction() == null) {
            return null;
        }
        Point2i cell = edgeRef.cell();
        return switch (edgeRef.direction()) {
            case NORTH -> new EdgeVertices(new Point2i(cell.x(), cell.y()), new Point2i(cell.x() + 1, cell.y()));
            case EAST -> new EdgeVertices(new Point2i(cell.x() + 1, cell.y()), new Point2i(cell.x() + 1, cell.y() + 1));
            case SOUTH -> new EdgeVertices(new Point2i(cell.x() + 1, cell.y() + 1), new Point2i(cell.x(), cell.y() + 1));
            case WEST -> new EdgeVertices(new Point2i(cell.x(), cell.y() + 1), new Point2i(cell.x(), cell.y()));
        };
    }

    private Point2i edgeStart(DungeonRoomCluster cluster, DungeonRoomCluster.EdgeOverride edge) {
        Point2i cell = previewClusterCell(cluster, edge.cell());
        return switch (edge.direction()) {
            case NORTH -> new Point2i(cell.x(), cell.y());
            case EAST -> new Point2i(cell.x() + 1, cell.y());
            case SOUTH -> new Point2i(cell.x() + 1, cell.y() + 1);
            case WEST -> new Point2i(cell.x(), cell.y() + 1);
        };
    }

    private Point2i edgeEnd(DungeonRoomCluster cluster, DungeonRoomCluster.EdgeOverride edge) {
        Point2i cell = previewClusterCell(cluster, edge.cell());
        return switch (edge.direction()) {
            case NORTH -> new Point2i(cell.x() + 1, cell.y());
            case EAST -> new Point2i(cell.x() + 1, cell.y() + 1);
            case SOUTH -> new Point2i(cell.x(), cell.y() + 1);
            case WEST -> new Point2i(cell.x(), cell.y());
        };
    }

    private javafx.scene.paint.Color strokeColor(DungeonCorridor corridor) {
        if (isSelected(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED;
        }
        if (isHovered(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.85);
        }
        if (isActive(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_ACTIVE;
        }
        return DungeonCanvasTheme.CORRIDOR;
    }

    private javafx.scene.paint.Color fillColor(DungeonCorridor corridor) {
        if (isSelected(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.30);
        }
        if (isHovered(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.22);
        }
        if (isActive(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_ACTIVE.deriveColor(0, 1, 1, 0.25);
        }
        return DungeonCanvasTheme.CORRIDOR.deriveColor(0, 1, 1, 0.16);
    }

    private javafx.scene.paint.Color doorColor(DungeonCorridor corridor) {
        if (isSelected(corridor)) {
            return DungeonCanvasTheme.DOOR_SELECTED;
        }
        if (isHovered(corridor)) {
            return DungeonCanvasTheme.DOOR_SELECTED.deriveColor(0, 1, 1, 0.85);
        }
        if (isActive(corridor)) {
            return DungeonCanvasTheme.DOOR_ACTIVE;
        }
        return DungeonCanvasTheme.DOOR;
    }

    private void drawRoom(
            GraphicsContext gc,
            Set<Point2i> cells,
            Point2D previewOffset,
            boolean active,
            boolean selected,
            Set<CorridorRenderKeys.CorridorSegmentKey> openSegments,
            Set<Long> encodedOpenSegments
    ) {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        gc.setFill(active ? DungeonCanvasTheme.ROOM_ACTIVE_FILL : DungeonCanvasTheme.ROOM_FILL);
        for (Point2i cell : cells) {
            double x = previewScreenX(cell.x(), previewOffset);
            double y = previewScreenY(cell.y(), previewOffset);
            double width = previewScreenX(cell.x() + 1, previewOffset) - x;
            double height = previewScreenY(cell.y() + 1, previewOffset) - y;
            gc.fillRect(x, y, width, height);
        }

        drawRegion(
                gc,
                cells,
                previewOffset,
                null,
                selected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.ROOM_STROKE,
                selected ? 3 : 2,
                openSegments,
                encodedOpenSegments);
    }

    private void drawRegion(
            GraphicsContext gc,
            Set<Point2i> cells,
            Point2D previewOffset,
            javafx.scene.paint.Color fill,
            javafx.scene.paint.Color stroke,
            double lineWidth,
            Set<CorridorRenderKeys.CorridorSegmentKey> openSegments,
            Set<Long> encodedOpenSegments
    ) {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        if (fill != null) {
            gc.setFill(fill);
            for (Point2i cell : cells) {
                double x = previewScreenX(cell.x(), previewOffset);
                double y = previewScreenY(cell.y(), previewOffset);
                double width = previewScreenX(cell.x() + 1, previewOffset) - x;
                double height = previewScreenY(cell.y() + 1, previewOffset) - y;
                gc.fillRect(x, y, width, height);
            }
        }
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        Set<Long> encodedCells = encodeCells(cells);
        for (Point2i cell : cells) {
            int x = cell.x();
            int y = cell.y();
            if (!encodedCells.contains(encodeCell(x, y - 1))
                    && !encodedOpenSegments.contains(encodeSegment(x, y, x + 1, y))) {
                gc.strokeLine(
                        previewScreenX(x, previewOffset),
                        previewScreenY(y, previewOffset),
                        previewScreenX(x + 1, previewOffset),
                        previewScreenY(y, previewOffset));
            }
            if (!encodedCells.contains(encodeCell(x + 1, y))
                    && !encodedOpenSegments.contains(encodeSegment(x + 1, y, x + 1, y + 1))) {
                gc.strokeLine(
                        previewScreenX(x + 1, previewOffset),
                        previewScreenY(y, previewOffset),
                        previewScreenX(x + 1, previewOffset),
                        previewScreenY(y + 1, previewOffset));
            }
            if (!encodedCells.contains(encodeCell(x, y + 1))
                    && !encodedOpenSegments.contains(encodeSegment(x, y + 1, x + 1, y + 1))) {
                gc.strokeLine(
                        previewScreenX(x + 1, previewOffset),
                        previewScreenY(y + 1, previewOffset),
                        previewScreenX(x, previewOffset),
                        previewScreenY(y + 1, previewOffset));
            }
            if (!encodedCells.contains(encodeCell(x - 1, y))
                    && !encodedOpenSegments.contains(encodeSegment(x, y, x, y + 1))) {
                gc.strokeLine(
                        previewScreenX(x, previewOffset),
                        previewScreenY(y + 1, previewOffset),
                        previewScreenX(x, previewOffset),
                        previewScreenY(y, previewOffset));
            }
        }
    }

    private Set<CorridorRenderKeys.CorridorSegmentKey> allDoorSegments() {
        Set<CorridorRenderKeys.CorridorSegmentKey> segments = new LinkedHashSet<>();
        if (corridorRenderDataForDisplay() == null || layout == null) {
            return segments;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                segments.add(CorridorRenderKeys.segmentKey(door.start(), door.end()));
            }
        }
        return segments;
    }

    private Set<Long> encodeCells(Set<Point2i> cells) {
        Set<Long> encoded = new LinkedHashSet<>();
        for (Point2i cell : cells) {
            encoded.add(encodeCell(cell.x(), cell.y()));
        }
        return encoded;
    }

    private Set<Long> encodeSegments(Set<CorridorRenderKeys.CorridorSegmentKey> segments) {
        Set<Long> encoded = new LinkedHashSet<>();
        for (CorridorRenderKeys.CorridorSegmentKey segment : segments) {
            encoded.add(encodeSegment(segment.start().x(), segment.start().y(),
                    segment.end().x(), segment.end().y()));
        }
        return encoded;
    }

    private long encodeCell(int x, int y) {
        return (((long) x) << 32) ^ (y & 0xffffffffL);
    }

    private long encodeSegment(int x1, int y1, int x2, int y2) {
        boolean ordered = x1 < x2 || (x1 == x2 && y1 <= y2);
        int startX = ordered ? x1 : x2;
        int startY = ordered ? y1 : y2;
        int endX = ordered ? x2 : x1;
        int endY = ordered ? y2 : y1;
        return encodeCell(startX, startY) * 31 + encodeCell(endX, endY);
    }

    private Set<Point2i> displayedCorridorCells(DungeonLayoutRenderData corridorRenderData) {
        if (layout == null || !hasClusterDragPreview()) {
            return corridorRenderData.corridorCells();
        }
        Set<Point2i> cells = new LinkedHashSet<>();
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            cells.addAll(geometry.cells());
        }
        return cells;
    }

    private void drawPreviewDoor(GraphicsContext gc) {
        CorridorEditInteractionController.DoorDragPreview preview = corridorDoorPreview();
        if (preview == null || preview.previewSegment() == null || previewCorridorDoorHandle == null) {
            return;
        }
        DungeonCorridor corridor = layout == null ? null : layout.corridorById(previewCorridorDoorHandle.corridorId());
        if (corridor == null) {
            return;
        }
        gc.setStroke(doorColor(corridor));
        gc.setLineWidth(isSelected(corridor) ? 7 : isHovered(corridor) ? 6.5 : 6);
        CorridorEditInteractionController.DoorPreviewSegment segment = preview.previewSegment();
        gc.strokeLine(
                camera.toScreenX(segment.startWorldX()),
                camera.toScreenY(segment.startWorldY()),
                camera.toScreenX(segment.endWorldX()),
                camera.toScreenY(segment.endWorldY()));
    }

    private record EdgeVertices(Point2i start, Point2i end) {
    }

    private record DoorAggregateHit(List<Long> corridorIds, long roomId) {
    }

    private record VertexCandidate(DungeonClusterVertexRef ref, boolean hoveredCluster, double distanceSquared) {
    }

    private record NearbyVertexSearch(
            double worldX,
            double worldY,
            int minVertexX,
            int maxVertexX,
            int minVertexY,
            int maxVertexY,
            double maxDistanceSquared
    ) {
    }

    private static double squaredDistance(double x1, double y1, double x2, double y2) {
        double dx = x1 - x2;
        double dy = y1 - y2;
        return dx * dx + dy * dy;
    }

    private NearbyVertexSearch nearbyVertexSearch(double screenX, double screenY) {
        double worldX = camera.toWorldX(screenX);
        double worldY = camera.toWorldY(screenY);
        return new NearbyVertexSearch(
                worldX,
                worldY,
                (int) Math.floor(worldX) - 1,
                (int) Math.ceil(worldX) + 1,
                (int) Math.floor(worldY) - 1,
                (int) Math.ceil(worldY) + 1,
                0.85 * 0.85);
    }

    private void drawPaintPreview(GraphicsContext gc) {
        if (previewPaintCells.isEmpty()) {
            return;
        }
        gc.setFill(DungeonCanvasTheme.ROOM_PREVIEW_FILL);
        gc.setStroke(DungeonCanvasTheme.ROOM_PREVIEW_STROKE);
        gc.setLineWidth(1.5);
        for (Point2i cell : previewPaintCells) {
            double x = camera.toScreenX(cell.x());
            double y = camera.toScreenY(cell.y());
            double size = camera.toScreenX(cell.x() + 1) - x;
            double height = camera.toScreenY(cell.y() + 1) - y;
            gc.fillRect(x, y, size, height);
            gc.strokeRect(x, y, size, height);
        }
    }

    private void drawSelectionPreview(GraphicsContext gc) {
        if (selectionStartCell == null || selectionEndCell == null) {
            return;
        }
        double x = camera.toScreenX(selectionMinX());
        double y = camera.toScreenY(selectionMinY());
        double width = camera.toScreenX(selectionMaxX() + 1) - x;
        double height = camera.toScreenY(selectionMaxY() + 1) - y;
        gc.setFill(DungeonCanvasTheme.SELECTION_FILL);
        gc.fillRect(x, y, width, height);
        gc.setStroke(DungeonCanvasTheme.SELECTION_STROKE);
        gc.setLineWidth(2);
        gc.strokeRect(x, y, width, height);
    }

    private static boolean isPreferredTieBreak(DungeonRoom candidate, DungeonRoom current) {
        if (candidate == null) {
            return false;
        }
        if (current == null || current.roomId() == null) {
            return true;
        }
        if (candidate.roomId() == null) {
            return false;
        }
        return candidate.roomId() < current.roomId();
    }
}
