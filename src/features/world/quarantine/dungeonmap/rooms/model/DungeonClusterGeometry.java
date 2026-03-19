package features.world.quarantine.dungeonmap.rooms.model;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRules;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonClusterGeometry {

    private DungeonClusterGeometry() {
        throw new AssertionError("No instances");
    }

    public static List<RoomShape> clusterComponentShapes(DungeonRoomCluster cluster) {
        if (cluster == null) {
            return List.of();
        }
        return clusterComponentShapes(cluster.center(), DungeonCellPolygonMath.cells(cluster), cluster.edgeOverrides());
    }

    public static List<RoomShape> clusterComponentShapes(
            Point2i clusterCenter,
            Collection<Point2i> clusterCells,
            List<DungeonRoomCluster.EdgeOverride> edgeOverrides
    ) {
        Objects.requireNonNull(clusterCells, "clusterCells");
        Set<Point2i> normalizedCells = Set.copyOf(clusterCells);
        if (normalizedCells.isEmpty()) {
            return List.of();
        }
        List<Set<Point2i>> components = clusterComponents(clusterCenter, normalizedCells, edgeOverrides);
        List<RoomShape> shapes = new ArrayList<>(components.size());
        for (Set<Point2i> component : components) {
            shapes.add(DungeonRoomGeometry.roomShapeForCells(component));
        }
        return List.copyOf(shapes);
    }

    public static Point2i toAbsoluteClusterCell(Point2i clusterCenter, Point2i relativeCell) {
        return clusterCenter == null ? relativeCell : clusterCenter.add(relativeCell);
    }

    public static Point2i toAbsoluteClusterCell(DungeonRoomCluster cluster, Point2i relativeCell) {
        return toAbsoluteClusterCell(cluster == null ? null : cluster.center(), relativeCell);
    }

    private static List<Set<Point2i>> clusterComponents(
            Point2i clusterCenter,
            Collection<Point2i> clusterCells,
            List<DungeonRoomCluster.EdgeOverride> edgeOverrides
    ) {
        Map<ClusterEdgeKey, DungeonRoomCluster.EdgeType> edgeTypes = new HashMap<>();
        for (DungeonRoomCluster.EdgeOverride edge : DungeonRoomCluster.sanitizeInternalEdges(clusterCenter, clusterCells, edgeOverrides)) {
            edgeTypes.put(ClusterEdgeKey.of(edge.absoluteCell(clusterCenter), edge.direction()), edge.type());
        }

        Set<Point2i> unvisited = new LinkedHashSet<>(clusterCells);
        List<Set<Point2i>> components = new ArrayList<>();
        while (!unvisited.isEmpty()) {
            Point2i seed = unvisited.iterator().next();
            Set<Point2i> component = new LinkedHashSet<>();
            ArrayDeque<Point2i> queue = new ArrayDeque<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Point2i current = queue.removeFirst();
                component.add(current);
                for (DungeonRoomCluster.EdgeDirection direction : DungeonRoomCluster.EdgeDirection.values()) {
                    Point2i neighbor = current.add(direction.delta());
                    if (!clusterCells.contains(neighbor) || !unvisited.contains(neighbor)) {
                        continue;
                    }
                    if (DungeonClusterEdgeRules.providesWall(edgeTypes.get(ClusterEdgeKey.of(current, direction)))) {
                        continue;
                    }
                    unvisited.remove(neighbor);
                    queue.addLast(neighbor);
                }
            }
            components.add(component);
        }
        components.sort(Comparator.<Set<Point2i>>comparingInt(Set::size).reversed());
        return components;
    }

    private record ClusterEdgeKey(Point2i cell, DungeonRoomCluster.EdgeDirection direction) {
        private static ClusterEdgeKey of(Point2i cell, DungeonRoomCluster.EdgeDirection direction) {
            return of(DungeonRoomCluster.EdgeOverride.of(cell, direction, DungeonRoomCluster.EdgeType.WALL));
        }

        private static ClusterEdgeKey of(DungeonRoomCluster.EdgeOverride edge) {
            return new ClusterEdgeKey(edge.cell(), edge.direction());
        }
    }
}
