package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorBoundaryHitTarget;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorBoundaryRef;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorConnectionHitTarget;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorRoomBoundaryHitTarget;
import javafx.geometry.Point2D;

import java.util.Map;
import java.util.Objects;

public final class DungeonBoundaryHitService {

    public DungeonEditorBoundaryHitTarget hitBoundary(
            DungeonLayout layout,
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            long priority
    ) {
        if (layout == null || canvasPoint == null || camera == null) {
            return null;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        double maxDistance = DungeonHitConventions.edgeTolerancePx(gridSize);
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

    public DungeonEditorConnectionHitTarget hitConnection(
            DungeonLayout layout,
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            long priority
    ) {
        if (layout == null || canvasPoint == null || camera == null) {
            return null;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        double maxDistance = DungeonHitConventions.edgeTolerancePx(gridSize);
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

    public DungeonEditorRoomBoundaryHitTarget hitRoomBoundary(
            DungeonLayout layout,
            Point2D canvasPoint,
            DungeonCanvasCamera camera,
            long priority
    ) {
        if (layout == null || canvasPoint == null || camera == null) {
            return null;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        double maxDistance = DungeonHitConventions.edgeTolerancePx(gridSize);
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
