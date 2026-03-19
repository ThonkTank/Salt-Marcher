package features.world.quarantine.dungeonmap.editor.workspace.grid;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;

final class DungeonGridVertexSupport {

    private final DungeonPaneContext context;
    private final DungeonPanePreviewModel previewModel;
    private final BiFunction<Double, Double, DungeonRoomCluster> clusterFinder;

    DungeonGridVertexSupport(
            DungeonPaneContext context,
            DungeonPanePreviewModel previewModel,
            BiFunction<Double, Double, DungeonRoomCluster> clusterFinder
    ) {
        this.context = context;
        this.previewModel = previewModel;
        this.clusterFinder = clusterFinder;
    }

    DungeonClusterEdgeRef findClusterEdgeAt(double screenX, double screenY) {
        if (context.dungeonLayout() == null || context.renderData() == null) {
            return null;
        }
        double worldX = context.camera().toWorldX(screenX);
        double worldY = context.camera().toWorldY(screenY);
        Point2i cell = new Point2i((int) Math.floor(worldX), (int) Math.floor(worldY));
        DungeonRoomCluster cluster = clusterFinder.apply(screenX, screenY);
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
        DungeonRoomCluster.EdgeDirection direction = DungeonRoomCluster.EdgeDirection.WEST;
        if (right < best) {
            best = right;
            direction = DungeonRoomCluster.EdgeDirection.EAST;
        }
        if (top < best) {
            best = top;
            direction = DungeonRoomCluster.EdgeDirection.NORTH;
        }
        if (bottom < best) {
            direction = DungeonRoomCluster.EdgeDirection.SOUTH;
        }
        return new DungeonClusterEdgeRef(cluster.clusterId(), cell, direction);
    }

    DungeonClusterVertexRef findClusterVertexAt(double screenX, double screenY) {
        List<DungeonClusterVertexRef> candidates = findClusterVerticesNear(screenX, screenY);
        return candidates.isEmpty() ? null : candidates.getFirst();
    }

    List<DungeonClusterVertexRef> findClusterVerticesNear(double screenX, double screenY) {
        if (context.dungeonLayout() == null) {
            return List.of();
        }
        NearbyVertexSearch search = nearbyVertexSearch(screenX, screenY);
        DungeonRoomCluster hoveredCluster = clusterFinder.apply(screenX, screenY);
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
        return candidates.stream().map(VertexCandidate::ref).toList();
    }

    DungeonClusterVertexRef findClusterVertexNear(long clusterId, double screenX, double screenY) {
        return findClusterVerticesNear(screenX, screenY).stream()
                .filter(r -> r.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    DungeonRoomCluster findClusterInSelection(Point2i startInclusive, Point2i endInclusive) {
        int minX = Math.min(startInclusive.x(), endInclusive.x());
        int maxX = Math.max(startInclusive.x(), endInclusive.x());
        int minY = Math.min(startInclusive.y(), endInclusive.y());
        int maxY = Math.max(startInclusive.y(), endInclusive.y());

        DungeonRoomCluster bestCluster = null;
        int bestOverlap = 0;
        for (DungeonRoomCluster cluster : context.dungeonLayout().clusters()) {
            Set<Point2i> clusterCells = previewModel.geometry().clusterCellsFor(cluster);
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

    List<Long> clusterIdsTouchingVertex(Point2i vertex) {
        if (vertex == null || context.dungeonLayout() == null) {
            return List.of();
        }
        if (!previewModel.hasClusterDragPreview() && context.renderData() != null) {
            return context.renderData().clusterIdsAtVertex(vertex);
        }
        List<Long> clusterIds = new ArrayList<>();
        for (DungeonRoomCluster cluster : context.dungeonLayout().clusters()) {
            if (cluster != null && cluster.clusterId() != null && clusterTouchesVertexPreviewAware(cluster, vertex)) {
                clusterIds.add(cluster.clusterId());
            }
        }
        return clusterIds;
    }

    boolean clusterTouchesVertex(DungeonRoomCluster cluster, Point2i vertex) {
        return cluster != null
                && cluster.clusterId() != null
                && vertex != null
                && clusterIdsTouchingVertex(vertex).contains(cluster.clusterId());
    }

    private boolean clusterTouchesVertexPreviewAware(DungeonRoomCluster cluster, Point2i vertex) {
        Set<Point2i> clusterCells = previewModel.geometry().clusterCellsFor(cluster);
        return clusterCells.contains(new Point2i(vertex.x(), vertex.y()))
                || clusterCells.contains(new Point2i(vertex.x() - 1, vertex.y()))
                || clusterCells.contains(new Point2i(vertex.x(), vertex.y() - 1))
                || clusterCells.contains(new Point2i(vertex.x() - 1, vertex.y() - 1));
    }

    private NearbyVertexSearch nearbyVertexSearch(double screenX, double screenY) {
        double worldX = context.camera().toWorldX(screenX);
        double worldY = context.camera().toWorldY(screenY);
        return new NearbyVertexSearch(
                worldX,
                worldY,
                (int) Math.floor(worldX) - 1,
                (int) Math.ceil(worldX) + 1,
                (int) Math.floor(worldY) - 1,
                (int) Math.ceil(worldY) + 1,
                DungeonCanvasTheme.HitTest.VERTEX_HIT_RADIUS_SQ);
    }

    private static double squaredDistance(double x1, double y1, double x2, double y2) {
        double dx = x1 - x2;
        double dy = y1 - y2;
        return dx * dx + dy * dy;
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
}
