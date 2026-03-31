package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.grid.DungeonGridInteractiveLabels;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.shell.interaction.DungeonBoundaryHitService;
import features.world.dungeonmap.shell.interaction.DungeonHitService;
import features.world.dungeonmap.shell.interaction.DungeonVertexHitService;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;

import java.util.Comparator;
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

    private final DungeonBoundaryHitService boundaryHitService;
    private final DungeonVertexHitService vertexHitService;
    private final DungeonHitService hitService;

    public DungeonEditorHitService() {
        this(new DungeonBoundaryHitService(), new DungeonVertexHitService(), new DungeonHitService());
    }

    public DungeonEditorHitService(
            DungeonBoundaryHitService boundaryHitService,
            DungeonVertexHitService vertexHitService,
            DungeonHitService hitService
    ) {
        this.boundaryHitService = Objects.requireNonNull(boundaryHitService, "boundaryHitService");
        this.vertexHitService = Objects.requireNonNull(vertexHitService, "vertexHitService");
        this.hitService = Objects.requireNonNull(hitService, "hitService");
    }

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
        return boundaryHitService.hitBoundary(layout, canvasPoint, camera, BOUNDARY_PRIORITY);
    }

    public DungeonEditorRoomBoundaryHitTarget hitRoomBoundary(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
        return boundaryHitService.hitRoomBoundary(layout, canvasPoint, camera, BOUNDARY_PRIORITY);
    }

    public Point2i hitVertex(Point2D canvasPoint, DungeonCanvasCamera camera) {
        return vertexHitService.hitVertex(canvasPoint, camera);
    }

    public DungeonEditorConnectionHitTarget hitConnection(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
        return boundaryHitService.hitConnection(layout, canvasPoint, camera, CONNECTION_PRIORITY);
    }

    public DungeonTransition hitTransition(DungeonLayout layout, Point2i cell, int level) {
        return hitService.transitionAtCell(layout, cell, level);
    }

    public DungeonStair hitStair(DungeonLayout layout, Point2i cell, int level) {
        return hitService.stairAtCell(layout, cell, level);
    }

    public Room roomAtCell(DungeonLayout layout, Point2i cell) {
        return hitService.roomAtCell(layout, cell);
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

}
