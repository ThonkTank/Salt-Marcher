package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.grid.DungeonGridInteractiveLabels;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;

import java.util.Comparator;
import java.util.Map;
import java.util.Objects;

public final class DungeonEditorHitService {

    private static final long LABEL_PRIORITY = 100L;
    private static final long CORRIDOR_NODE_PRIORITY = 80L;
    private static final long CORRIDOR_CORNER_PRIORITY = 70L;
    private static final long CORRIDOR_SEGMENT_PRIORITY = 60L;
    private static final long CONNECTION_PRIORITY = 50L;
    private static final long BOUNDARY_PRIORITY = 40L;
    private static final long ROOM_TILE_PRIORITY = 20L;
    private static final long FLOOR_CELL_PRIORITY = 10L;

    private final BoundaryHitStrategy boundaryHits = new BoundaryHitStrategy();
    private final VertexHitStrategy vertexHits = new VertexHitStrategy();

    public DungeonEditorHitTarget hitAt(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
        if (layout == null || canvasPoint == null || camera == null) {
            return null;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        DungeonEditorLabelHitTarget label = hitLabel(layout, canvasPoint, camera, gridSize);
        if (label != null) {
            return label;
        }
        DungeonEditorCorridorNodeHitTarget node = hitCorridorNode(layout, canvasPoint, camera, gridSize);
        if (node != null) {
            return node;
        }
        DungeonEditorCorridorCornerHitTarget corner = hitCorridorCorner(layout, canvasPoint, camera, gridSize);
        if (corner != null) {
            return corner;
        }
        DungeonEditorCorridorSegmentHitTarget corridorSegment = hitCorridorSegment(layout, canvasPoint, camera, gridSize);
        if (corridorSegment != null) {
            return corridorSegment;
        }
        DungeonEditorConnectionHitTarget connection = hitConnection(layout, canvasPoint, camera);
        if (connection != null) {
            return connection;
        }
        DungeonEditorBoundaryHitTarget boundary = hitBoundary(layout, canvasPoint, camera);
        if (boundary != null) {
            return boundary;
        }
        DungeonEditorRoomBoundaryHitTarget roomBoundary = hitRoomBoundary(layout, canvasPoint, camera);
        if (roomBoundary != null) {
            return roomBoundary;
        }
        DungeonEditorRoomHitTarget room = roomHit(layout, canvasPoint, camera, gridSize);
        if (room != null) {
            return room;
        }
        return floorHit(canvasPoint, camera, gridSize);
    }

    public DungeonEditorBoundaryHitTarget hitBoundary(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
        return boundaryHits.hitBoundary(layout, canvasPoint, camera, BOUNDARY_PRIORITY);
    }

    public DungeonEditorRoomBoundaryHitTarget hitRoomBoundary(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
        return boundaryHits.hitRoomBoundary(layout, canvasPoint, camera, BOUNDARY_PRIORITY);
    }

    public Point2i hitVertex(Point2D canvasPoint, DungeonCanvasCamera camera) {
        return vertexHits.hitVertex(canvasPoint, camera);
    }

    public DungeonEditorConnectionHitTarget hitConnection(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
        return boundaryHits.hitConnection(layout, canvasPoint, camera, CONNECTION_PRIORITY);
    }

    public DungeonTransition hitTransition(DungeonLayout layout, Point2i cell, int level) {
        if (layout == null || cell == null) {
            return null;
        }
        return layout.transitionsAtCell(cell, level).stream()
                .filter(candidate -> candidate != null && candidate.transitionId() != null)
                .min(Comparator.comparing(DungeonTransition::transitionId))
                .orElse(null);
    }

    public DungeonStair hitStair(DungeonLayout layout, Point2i cell, int level) {
        if (layout == null || cell == null) {
            return null;
        }
        return layout.stairsAtCell(cell, level).stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null)
                .min(Comparator.comparing(DungeonStair::stairId))
                .orElse(null);
    }

    public Room roomAtCell(DungeonLayout layout, Point2i cell) {
        if (layout == null || cell == null) {
            return null;
        }
        Room room = layout.roomAtCell(cell);
        return room != null && room.roomId() != null ? room : null;
    }

    private DungeonEditorLabelHitTarget hitLabel(
            DungeonLayout layout,
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            double gridSize
    ) {
        DungeonEditorLabelHitTarget bestTarget = null;
        double bestDistance = Double.MAX_VALUE;
        for (RoomCluster cluster : layout.clusters()) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            InteractiveLabelHandle handle = cluster.labelHandle();
            Rectangle2D bounds = DungeonGridInteractiveLabels.bounds(handle, camera, gridSize);
            if (!bounds.contains(canvasPoint)) {
                continue;
            }
            DungeonEditorLabelHitTarget target = new DungeonEditorLabelHitTarget(handle, cluster.clusterId(), LABEL_PRIORITY);
            Point2D anchorPoint = DungeonGridInteractiveLabels.anchorPoint(handle, camera, gridSize);
            double distance = anchorPoint.distance(canvasPoint);
            if (bestTarget == null || distance < bestDistance) {
                bestTarget = target;
                bestDistance = distance;
            }
        }
        return bestTarget;
    }

    private DungeonEditorCorridorNodeHitTarget hitCorridorNode(
            DungeonLayout layout,
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            double gridSize
    ) {
        double maxDistance = Math.max(8.0, gridSize * 0.22);
        DungeonEditorCorridorNodeHitTarget best = null;
        double bestDistance = maxDistance;
        for (Corridor corridor : layout.corridors()) {
            if (corridor == null) {
                continue;
            }
            for (var node : corridor.persistedManualNodes()) {
                Point2i doubled = new Point2i(node.gridX2(), node.gridY2());
                double distance = canvasPoint.distance(canvasPointForDoubled(doubled, camera, gridSize));
                if (distance > bestDistance) {
                    continue;
                }
                best = new DungeonEditorCorridorNodeHitTarget(corridor, node, doubled, CORRIDOR_NODE_PRIORITY);
                bestDistance = distance;
            }
        }
        return best;
    }

    private DungeonEditorCorridorCornerHitTarget hitCorridorCorner(
            DungeonLayout layout,
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            double gridSize
    ) {
        double maxDistance = Math.max(7.0, gridSize * 0.18);
        DungeonEditorCorridorCornerHitTarget best = null;
        double bestDistance = maxDistance;
        for (Corridor corridor : layout.corridors()) {
            if (corridor == null) {
                continue;
            }
            for (Corridor.CorridorRoute route : corridor.routes()) {
                for (Point2i corner : route.cornerPoints()) {
                    double distance = canvasPoint.distance(canvasPointForDoubled(corner, camera, gridSize));
                    if (distance > bestDistance) {
                        continue;
                    }
                    best = new DungeonEditorCorridorCornerHitTarget(corridor, route, corner, CORRIDOR_CORNER_PRIORITY);
                    bestDistance = distance;
                }
            }
        }
        return best;
    }

    private DungeonEditorCorridorSegmentHitTarget hitCorridorSegment(
            DungeonLayout layout,
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            double gridSize
    ) {
        double maxDistance = Math.max(7.0, gridSize * 0.18);
        DungeonEditorCorridorSegmentHitTarget best = null;
        double bestDistance = maxDistance;
        for (Corridor corridor : layout.corridors()) {
            if (corridor == null) {
                continue;
            }
            for (Corridor.CorridorRoute route : corridor.routes()) {
                Point2i bestPoint = null;
                for (VertexEdge edge : route.doubledEdges()) {
                    double distance = distanceToDoubledEdge(canvasPoint, edge, camera, gridSize);
                    if (distance > bestDistance) {
                        continue;
                    }
                    bestDistance = distance;
                    bestPoint = nearestPointOnEdge(edge, canvasPoint, camera, gridSize);
                }
                if (bestPoint != null) {
                    best = new DungeonEditorCorridorSegmentHitTarget(corridor, route, bestPoint, CORRIDOR_SEGMENT_PRIORITY);
                }
            }
        }
        return best;
    }

    private DungeonEditorRoomHitTarget roomHit(
            DungeonLayout layout,
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            double gridSize
    ) {
        if (gridSize <= 0.0) {
            return null;
        }
        Point2i cell = gridCell(canvasPoint, camera, gridSize);
        Room room = layout.roomAtCell(cell);
        if (room == null || room.roomId() == null) {
            return null;
        }
        return new DungeonEditorRoomHitTarget(room, ROOM_TILE_PRIORITY);
    }

    private DungeonEditorFloorCellHitTarget floorHit(
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            double gridSize
    ) {
        if (gridSize <= 0.0) {
            return null;
        }
        return new DungeonEditorFloorCellHitTarget(gridCell(canvasPoint, camera, gridSize), FLOOR_CELL_PRIORITY);
    }

    private static Point2i gridCell(Point2D canvasPoint, DungeonCanvasCamera camera, double gridSize) {
        double worldX = (canvasPoint.getX() - camera.panX()) / gridSize;
        double worldY = (canvasPoint.getY() - camera.panY()) / gridSize;
        return new Point2i((int) Math.floor(worldX), (int) Math.floor(worldY));
    }

    private static Point2D canvasPointForDoubled(Point2i doubledPoint, DungeonCanvasCamera camera, double gridSize) {
        return new Point2D(
                camera.panX() + (doubledPoint.x() * gridSize / 2.0),
                camera.panY() + (doubledPoint.y() * gridSize / 2.0));
    }

    private static double distanceToDoubledEdge(
            Point2D canvasPoint,
            VertexEdge doubledEdge,
            DungeonCanvasCamera camera,
            double gridSize
    ) {
        Point2D start = canvasPointForDoubled(doubledEdge.start(), camera, gridSize);
        Point2D end = canvasPointForDoubled(doubledEdge.end(), camera, gridSize);
        double dx = end.getX() - start.getX();
        double dy = end.getY() - start.getY();
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared <= 0.0) {
            return canvasPoint.distance(start);
        }
        double projection = ((canvasPoint.getX() - start.getX()) * dx + (canvasPoint.getY() - start.getY()) * dy) / lengthSquared;
        double clamped = Math.max(0.0, Math.min(1.0, projection));
        double nearestX = start.getX() + clamped * dx;
        double nearestY = start.getY() + clamped * dy;
        return canvasPoint.distance(nearestX, nearestY);
    }

    private static Point2i nearestPointOnEdge(
            VertexEdge doubledEdge,
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            double gridSize
    ) {
        Point2D start = canvasPointForDoubled(doubledEdge.start(), camera, gridSize);
        Point2D end = canvasPointForDoubled(doubledEdge.end(), camera, gridSize);
        double dx = end.getX() - start.getX();
        double dy = end.getY() - start.getY();
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared <= 0.0) {
            return doubledEdge.start();
        }
        double projection = ((canvasPoint.getX() - start.getX()) * dx + (canvasPoint.getY() - start.getY()) * dy) / lengthSquared;
        double clamped = Math.max(0.0, Math.min(1.0, projection));
        double nearestX = doubledEdge.start().x() + clamped * (doubledEdge.end().x() - doubledEdge.start().x());
        double nearestY = doubledEdge.start().y() + clamped * (doubledEdge.end().y() - doubledEdge.start().y());
        return new Point2i((int) Math.round(nearestX), (int) Math.round(nearestY));
    }

    private static final class BoundaryHitStrategy {

        private DungeonEditorBoundaryHitTarget hitBoundary(
                DungeonLayout layout,
                Point2D canvasPoint,
                DungeonCanvasCamera camera,
                long priority
        ) {
            if (layout == null || canvasPoint == null || camera == null) {
                return null;
            }
            double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
            double maxDistance = Math.max(7.0, gridSize * 0.22);
            DungeonEditorBoundaryHitTarget bestTarget = null;
            double bestDistance = maxDistance;
            for (RoomCluster cluster : layout.clusters()) {
                if (cluster == null || cluster.clusterId() == null) {
                    continue;
                }
                for (Map.Entry<VertexEdge, InternalBoundaryType> entry : cluster.internalBoundaryKinds().entrySet()) {
                    VertexEdge edge = entry.getKey();
                    double distance = distanceToEdge(canvasPoint, edge, camera, gridSize);
                    if (distance > bestDistance) {
                        continue;
                    }
                    Point2i baseCell = edge.touchingCells().stream()
                            .sorted(Point2i.POINT_ORDER)
                            .findFirst()
                            .orElse(null);
                    Point2i direction = edge.directionFrom(baseCell);
                    if (baseCell == null || direction == null) {
                        continue;
                    }
                    bestTarget = new DungeonEditorBoundaryHitTarget(
                            new DungeonEditorBoundaryRef(cluster.clusterId(), baseCell, direction),
                            edge,
                            entry.getValue(),
                            priority);
                    bestDistance = distance;
                }
            }
            return bestTarget;
        }

        private DungeonEditorConnectionHitTarget hitConnection(
                DungeonLayout layout,
                Point2D canvasPoint,
                DungeonCanvasCamera camera,
                long priority
        ) {
            if (layout == null || canvasPoint == null || camera == null) {
                return null;
            }
            double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
            double maxDistance = Math.max(7.0, gridSize * 0.22);
            DungeonEditorConnectionHitTarget bestTarget = null;
            double bestDistance = maxDistance;
            for (Connection connection : layout.connections()) {
                if (connection == null || connection.door() == null) {
                    continue;
                }
                for (VertexEdge edge : connection.door().edges().stream().filter(Objects::nonNull).toList()) {
                    double distance = distanceToEdge(canvasPoint, edge, camera, gridSize);
                    if (distance > bestDistance) {
                        continue;
                    }
                    bestTarget = new DungeonEditorConnectionHitTarget(connection, edge, priority);
                    bestDistance = distance;
                }
            }
            return bestTarget;
        }

        private DungeonEditorRoomBoundaryHitTarget hitRoomBoundary(
                DungeonLayout layout,
                Point2D canvasPoint,
                DungeonCanvasCamera camera,
                long priority
        ) {
            if (layout == null || canvasPoint == null || camera == null) {
                return null;
            }
            double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
            double maxDistance = Math.max(7.0, gridSize * 0.22);
            DungeonEditorRoomBoundaryHitTarget bestTarget = null;
            double bestDistance = maxDistance;
            for (Room room : layout.rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                for (VertexEdge edge : room.boundaryEdges()) {
                    if (layout.connectionAt(edge) != null) {
                        continue;
                    }
                    double distance = distanceToEdge(canvasPoint, edge, camera, gridSize);
                    if (distance > bestDistance) {
                        continue;
                    }
                    RoomBoundaryGeometry geometry = roomBoundaryGeometry(layout, room, edge);
                    if (geometry == null) {
                        continue;
                    }
                    bestTarget = new DungeonEditorRoomBoundaryHitTarget(
                            room,
                            edge,
                            geometry.roomCell(),
                            geometry.outwardStep(),
                            geometry.exterior(),
                            priority);
                    bestDistance = distance;
                }
            }
            return bestTarget;
        }

        private static double distanceToEdge(Point2D canvasPoint, VertexEdge edge, DungeonCanvasCamera camera, double gridSize) {
            Point2D start = canvasPoint(edge.start(), camera, gridSize);
            Point2D end = canvasPoint(edge.end(), camera, gridSize);
            double dx = end.getX() - start.getX();
            double dy = end.getY() - start.getY();
            double lengthSquared = dx * dx + dy * dy;
            if (lengthSquared <= 0.0) {
                return canvasPoint.distance(start);
            }
            double projection = ((canvasPoint.getX() - start.getX()) * dx + (canvasPoint.getY() - start.getY()) * dy) / lengthSquared;
            double clamped = Math.max(0.0, Math.min(1.0, projection));
            double nearestX = start.getX() + clamped * dx;
            double nearestY = start.getY() + clamped * dy;
            return canvasPoint.distance(nearestX, nearestY);
        }

        private static Point2D canvasPoint(Point2i point, DungeonCanvasCamera camera, double gridSize) {
            return new Point2D(
                    camera.panX() + point.x() * gridSize,
                    camera.panY() + point.y() * gridSize);
        }

        private static RoomBoundaryGeometry roomBoundaryGeometry(DungeonLayout layout, Room room, VertexEdge edge) {
            if (layout == null || room == null || edge == null) {
                return null;
            }
            for (Point2i cell : edge.touchingCells().stream().sorted(Point2i.POINT_ORDER).toList()) {
                if (!room.contains(cell)) {
                    continue;
                }
                Point2i outwardStep = edge.directionFrom(cell);
                Point2i opposite = outwardStep == null ? null : cell.add(outwardStep);
                boolean exterior = opposite == null || layout.roomAtCell(opposite) == null;
                return new RoomBoundaryGeometry(cell, outwardStep, exterior);
            }
            return null;
        }

        private record RoomBoundaryGeometry(Point2i roomCell, Point2i outwardStep, boolean exterior) {
        }
    }

    private static final class VertexHitStrategy {

        private Point2i hitVertex(Point2D canvasPoint, DungeonCanvasCamera camera) {
            if (canvasPoint == null || camera == null) {
                return null;
            }
            double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
            if (gridSize <= 0.0) {
                return null;
            }
            double gridX = (canvasPoint.getX() - camera.panX()) / gridSize;
            double gridY = (canvasPoint.getY() - camera.panY()) / gridSize;
            int vertexX = (int) Math.round(gridX);
            int vertexY = (int) Math.round(gridY);
            double snapX = camera.panX() + vertexX * gridSize;
            double snapY = camera.panY() + vertexY * gridSize;
            double maxDistance = Math.max(8.0, gridSize * 0.28);
            return canvasPoint.distance(snapX, snapY) <= maxDistance ? new Point2i(vertexX, vertexY) : null;
        }
    }
}
