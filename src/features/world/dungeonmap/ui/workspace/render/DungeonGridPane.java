package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.DungeonClusterGeometry;
import features.world.dungeonmap.model.DoorSegment;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
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
        drawGrid(gc);
        drawCorridors(gc);

        for (DungeonRoomCluster cluster : layout.clusters()) {
            Set<Point2i> cells = clusterCellsFor(cluster);
            boolean active = isActive(cluster);
            boolean selected = isSelected(cluster);
            drawRoom(gc, cells, active, selected);
            Point2i previewCenter = previewCenter(cluster);
            double centerX = camera.toScreenX(previewCenter.x() + 0.5);
            double centerY = camera.toScreenY(previewCenter.y() + 0.5);
            gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
            gc.fillOval(centerX - 4, centerY - 4, 8, 8);
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
        if (previewClusterCenters.isEmpty()) {
            DungeonRoomCluster cluster = renderData == null ? null : renderData.clusterAtCell(cell);
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
        if (previewClusterCenters.isEmpty()) {
            DungeonRoom room = renderData == null ? null : renderData.roomAtCell(cell);
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
        if (layout == null || renderData == null) {
            return null;
        }
        Point2i cell = worldPointAt(screenX, screenY);
        if (previewClusterCenters.isEmpty()) {
            List<Long> corridorIds = renderData.corridorIdsAtCell(cell);
            if (!corridorIds.isEmpty()) {
                return layout.corridorById(corridorIds.get(0));
            }
        }
        DungeonCorridor bestCorridor = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
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
        if (layout == null || renderData == null) {
            return null;
        }
        DoorAggregateHit bestHit = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
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
                    List<Long> corridorIds = renderData.corridorIdsForDoorFromRoom(door);
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

    private void drawCorridors(GraphicsContext gc) {
        DungeonLayoutRenderData corridorRenderData = corridorRenderDataForDisplay();
        if (corridorRenderData == null) {
            return;
        }
        Set<Point2i> allCorridorCells = displayedCorridorCells(corridorRenderData);
        if (allCorridorCells.isEmpty()) {
            return;
        }
        drawRegion(gc, allCorridorCells, DungeonCanvasTheme.CORRIDOR, DungeonCanvasTheme.ROOM_STROKE, 2, allDoorSegments());

        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable() || geometry.cells().isEmpty()) {
                continue;
            }
            gc.setFill(fillColor(corridor));
            for (Point2i cell : geometry.cells()) {
                double x = camera.toScreenX(cell.x());
                double y = camera.toScreenY(cell.y());
                double width = camera.toScreenX(cell.x() + 1) - x;
                double height = camera.toScreenY(cell.y() + 1) - y;
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
                gc.strokeLine(
                        camera.toScreenX(door.start().x()),
                        camera.toScreenY(door.start().y()),
                        camera.toScreenX(door.end().x()),
                        camera.toScreenY(door.end().y()));
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
        for (features.world.dungeonmap.model.GridSegment segment : context.geometry().segments()) {
            gc.strokeLine(
                    camera.toScreenX(segment.from().x() + 0.5),
                    camera.toScreenY(segment.from().y() + 0.5),
                    camera.toScreenX(segment.to().x() + 0.5),
                    camera.toScreenY(segment.to().y() + 0.5));
        }
        gc.setLineWidth(2);
        for (DoorSegment door : context.geometry().doors()) {
            double centerX = (camera.toScreenX(door.start().x()) + camera.toScreenX(door.end().x())) / 2.0;
            double centerY = (camera.toScreenY(door.start().y()) + camera.toScreenY(door.end().y())) / 2.0;
            CorridorEditInteractionController.DoorHandle handle = corridorDoorHandleForRoom(door.roomId());
            double radius = isSelected(handle) ? 6 : 5;
            gc.setFill(isSelected(handle) ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.DOOR_SELECTED);
            gc.fillOval(centerX - radius, centerY - radius, radius * 2, radius * 2);
            gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
            gc.strokeOval(centerX - radius, centerY - radius, radius * 2, radius * 2);
        }
        for (Point2i waypoint : context.geometry().waypointCells()) {
            double centerX = camera.toScreenX(waypoint.x() + 0.5);
            double centerY = camera.toScreenY(waypoint.y() + 0.5);
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
                gc.setStroke(edge.type() == DungeonRoomCluster.EdgeType.WALL
                        ? DungeonCanvasTheme.ROOM_SELECTED_STROKE
                        : DungeonCanvasTheme.DOOR);
                gc.setLineWidth(edge.type() == DungeonRoomCluster.EdgeType.WALL ? 4 : 6);
                gc.strokeLine(
                        camera.toScreenX(start.x()),
                        camera.toScreenY(start.y()),
                        camera.toScreenX(end.x()),
                        camera.toScreenY(end.y()));
            }
        }
    }

    private void drawWallPathPreview(GraphicsContext gc) {
        if (editorTool != DungeonEditorTool.CLUSTER_WALL) {
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

    private void drawWallAnchor(GraphicsContext gc, DungeonClusterEdgeRef edgeRef, javafx.scene.paint.Color color) {
        EdgeVertices vertices = edgeVertices(edgeRef);
        if (vertices == null) {
            return;
        }
        double centerX = (camera.toScreenX(vertices.start().x()) + camera.toScreenX(vertices.end().x())) / 2.0;
        double centerY = (camera.toScreenY(vertices.start().y()) + camera.toScreenY(vertices.end().y())) / 2.0;
        gc.setFill(color);
        gc.fillOval(centerX - 4.5, centerY - 4.5, 9, 9);
        gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(1.5);
        gc.strokeOval(centerX - 4.5, centerY - 4.5, 9, 9);
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

    private void drawRoom(GraphicsContext gc, Set<Point2i> cells, boolean active, boolean selected) {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        gc.setFill(active ? DungeonCanvasTheme.ROOM_ACTIVE_FILL : DungeonCanvasTheme.ROOM_FILL);
        for (Point2i cell : cells) {
            double x = camera.toScreenX(cell.x());
            double y = camera.toScreenY(cell.y());
            double width = camera.toScreenX(cell.x() + 1) - x;
            double height = camera.toScreenY(cell.y() + 1) - y;
            gc.fillRect(x, y, width, height);
        }

        drawRegion(
                gc,
                cells,
                null,
                selected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.ROOM_STROKE,
                selected ? 3 : 2,
                allDoorSegments());
    }

    private void drawRegion(
            GraphicsContext gc,
            Set<Point2i> cells,
            javafx.scene.paint.Color fill,
            javafx.scene.paint.Color stroke,
            double lineWidth,
            Set<SegmentKey> openSegments
    ) {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        if (fill != null) {
            gc.setFill(fill);
            for (Point2i cell : cells) {
                double x = camera.toScreenX(cell.x());
                double y = camera.toScreenY(cell.y());
                double width = camera.toScreenX(cell.x() + 1) - x;
                double height = camera.toScreenY(cell.y() + 1) - y;
                gc.fillRect(x, y, width, height);
            }
        }
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        for (Point2i cell : cells) {
            if (!cells.contains(new Point2i(cell.x(), cell.y() - 1))
                    && !openSegments.contains(SegmentKey.of(new Point2i(cell.x(), cell.y()), new Point2i(cell.x() + 1, cell.y())))) {
                gc.strokeLine(
                        camera.toScreenX(cell.x()),
                        camera.toScreenY(cell.y()),
                        camera.toScreenX(cell.x() + 1),
                        camera.toScreenY(cell.y()));
            }
            if (!cells.contains(new Point2i(cell.x() + 1, cell.y()))
                    && !openSegments.contains(SegmentKey.of(new Point2i(cell.x() + 1, cell.y()), new Point2i(cell.x() + 1, cell.y() + 1)))) {
                gc.strokeLine(
                        camera.toScreenX(cell.x() + 1),
                        camera.toScreenY(cell.y()),
                        camera.toScreenX(cell.x() + 1),
                        camera.toScreenY(cell.y() + 1));
            }
            if (!cells.contains(new Point2i(cell.x(), cell.y() + 1))
                    && !openSegments.contains(SegmentKey.of(new Point2i(cell.x(), cell.y() + 1), new Point2i(cell.x() + 1, cell.y() + 1)))) {
                gc.strokeLine(
                        camera.toScreenX(cell.x() + 1),
                        camera.toScreenY(cell.y() + 1),
                        camera.toScreenX(cell.x()),
                        camera.toScreenY(cell.y() + 1));
            }
            if (!cells.contains(new Point2i(cell.x() - 1, cell.y()))
                    && !openSegments.contains(SegmentKey.of(new Point2i(cell.x(), cell.y()), new Point2i(cell.x(), cell.y() + 1)))) {
                gc.strokeLine(
                        camera.toScreenX(cell.x()),
                        camera.toScreenY(cell.y() + 1),
                        camera.toScreenX(cell.x()),
                        camera.toScreenY(cell.y()));
            }
        }
    }

    private Set<SegmentKey> allDoorSegments() {
        Set<SegmentKey> segments = new LinkedHashSet<>();
        if (corridorRenderDataForDisplay() == null || layout == null) {
            return segments;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                segments.add(SegmentKey.of(door.start(), door.end()));
            }
        }
        return segments;
    }

    private Set<Point2i> displayedCorridorCells(DungeonLayoutRenderData corridorRenderData) {
        if (previewCorridorGeometry == null || layout == null) {
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

    private record SegmentKey(Point2i start, Point2i end) {
        private static SegmentKey of(Point2i a, Point2i b) {
            if (a.x() < b.x() || (a.x() == b.x() && a.y() <= b.y())) {
                return new SegmentKey(a, b);
            }
            return new SegmentKey(b, a);
        }
    }

    private record EdgeVertices(Point2i start, Point2i end) {
    }

    private record DoorAggregateHit(List<Long> corridorIds, long roomId) {
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
