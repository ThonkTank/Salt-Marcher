package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.DungeonClusterGeometry;
import features.world.dungeonmap.model.DoorSegment;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;
import javafx.scene.canvas.GraphicsContext;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;

public final class DungeonGridPane extends AbstractDungeonPane {

    public DungeonGridPane(DungeonCanvasCamera camera) {
        super(camera);
    }

    @Override
    protected void renderContent(GraphicsContext gc) {
        drawGrid(gc);
        drawCorridors(gc);

        for (DungeonRoomCluster cluster : layout.clusters()) {
            Set<Point2i> cells = layout.clusterCells(cluster.clusterId());
            boolean active = isActive(cluster);
            boolean selected = isSelected(cluster);
            drawRoom(gc, cells, active, selected);
            double centerX = camera.toScreenX(cluster.center().x() + 0.5);
            double centerY = camera.toScreenY(cluster.center().y() + 0.5);
            gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
            gc.fillOval(centerX - 4, centerY - 4, 8, 8);
        }
        drawClusterEdges(gc);
        drawDoors(gc);

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
        for (DungeonRoomCluster cluster : layout.clusters()) {
            if (layout.clusterCells(cluster.clusterId()).contains(cell)) {
                return cluster;
            }
        }
        return null;
    }

    @Override
    protected DungeonRoom findRoomAt(double screenX, double screenY) {
        Point2i cell = worldPointAt(screenX, screenY);
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
                    java.util.List<Long> corridorIds = layout.corridors().stream()
                            .filter(candidate -> usesDoorFromRoom(candidate, door))
                            .map(DungeonCorridor::corridorId)
                            .filter(java.util.Objects::nonNull)
                            .sorted()
                            .toList();
                    bestHit = new DoorAggregateHit(corridorIds, door.roomId());
                }
            }
        }
        return bestHit == null ? null : new CorridorDoorHit(bestHit.corridorIds(), bestHit.roomId());
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
            Set<Point2i> clusterCells = layout.clusterCells(cluster.clusterId());
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
        if (renderData == null) {
            return;
        }
        Set<Point2i> allCorridorCells = renderData.corridorCells();
        if (allCorridorCells.isEmpty()) {
            return;
        }
        drawRegion(gc, allCorridorCells, DungeonCanvasTheme.CORRIDOR, DungeonCanvasTheme.ROOM_STROKE, 2, allDoorSegments());

        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
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
        if (renderData == null) {
            return;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            gc.setStroke(doorColor(corridor));
            gc.setLineWidth(isSelected(corridor) ? 7 : 6);
            for (DoorSegment door : geometry.doors()) {
                gc.strokeLine(
                        camera.toScreenX(door.start().x()),
                        camera.toScreenY(door.start().y()),
                        camera.toScreenX(door.end().x()),
                        camera.toScreenY(door.end().y()));
            }
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

    private static Point2i edgeStart(DungeonRoomCluster cluster, DungeonRoomCluster.EdgeOverride edge) {
        Point2i cell = DungeonClusterGeometry.toAbsoluteClusterCell(cluster, edge.cell());
        return switch (edge.direction()) {
            case NORTH -> new Point2i(cell.x(), cell.y());
            case EAST -> new Point2i(cell.x() + 1, cell.y());
            case SOUTH -> new Point2i(cell.x() + 1, cell.y() + 1);
            case WEST -> new Point2i(cell.x(), cell.y() + 1);
        };
    }

    private static Point2i edgeEnd(DungeonRoomCluster cluster, DungeonRoomCluster.EdgeOverride edge) {
        Point2i cell = DungeonClusterGeometry.toAbsoluteClusterCell(cluster, edge.cell());
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
        if (isActive(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_ACTIVE;
        }
        return DungeonCanvasTheme.CORRIDOR;
    }

    private javafx.scene.paint.Color fillColor(DungeonCorridor corridor) {
        if (isSelected(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.30);
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
        if (isActive(corridor)) {
            return DungeonCanvasTheme.DOOR_ACTIVE;
        }
        return DungeonCanvasTheme.DOOR;
    }

    private boolean usesDoorFromRoom(DungeonCorridor corridor, DoorSegment door) {
        if (corridor == null || corridor.corridorId() == null) {
            return false;
        }
        CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
        if (geometry == null || !geometry.routable()) {
            return false;
        }
        return geometry.doors().stream().anyMatch(candidate ->
                candidate.roomId() == door.roomId()
                        && sameDoorSegment(candidate, door));
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
        if (renderData == null || layout == null) {
            return segments;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = renderData.corridorGeometry(corridor.corridorId());
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                segments.add(SegmentKey.of(door.start(), door.end()));
            }
        }
        return segments;
    }

    private record SegmentKey(Point2i start, Point2i end) {
        private static SegmentKey of(Point2i a, Point2i b) {
            if (a.x() < b.x() || (a.x() == b.x() && a.y() <= b.y())) {
                return new SegmentKey(a, b);
            }
            return new SegmentKey(b, a);
        }
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
