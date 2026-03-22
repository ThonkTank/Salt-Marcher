package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.persistence.ClusterBoundaryWrite;
import javafx.geometry.Point2D;

import java.util.Map;

final class DungeonGridBoundaryHitTester {

    private static final long BOUNDARY_PRIORITY = 10L;

    DungeonEditorBoundaryHitTarget hitTest(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
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
            for (Map.Entry<VertexEdge, ClusterBoundaryWrite.Type> entry : cluster.internalBoundaryKinds().entrySet()) {
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
                        new DungeonEditorTargetRef.BoundaryRef(cluster.clusterId(), baseCell, direction),
                        edge,
                        entry.getValue(),
                        BOUNDARY_PRIORITY);
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
}
