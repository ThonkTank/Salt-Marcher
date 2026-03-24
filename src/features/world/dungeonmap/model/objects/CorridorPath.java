package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Runtime-owned resolved corridor path object.
 *
 * <p>CorridorPath owns the current route intent, resolved corridor floor, and resolved corridor doors for one
 * corridor. The canonical editable truth still lives in the corridor structure bindings.</p>
 */
public record CorridorPath(
        GridRoute route,
        Map<Integer, Floor> floorsByLevel,
        Map<Integer, Set<VertexEdge>> doorEdgesByLevel,
        boolean directlyAdjacent,
        boolean routable
) {
    public CorridorPath {
        route = route == null ? GridRoute.empty() : route;
        floorsByLevel = copyFloorsByLevel(floorsByLevel);
        doorEdgesByLevel = copyDoorEdgesByLevel(doorEdgesByLevel);
    }

    public static CorridorPath empty() {
        return new CorridorPath(
                GridRoute.empty(),
                Map.of(),
                Map.of(),
                false,
                false);
    }

    public static CorridorPath unroutable(GridRoute route) {
        return new CorridorPath(
                route,
                Map.of(),
                Map.of(),
                false,
                false);
    }

    public Floor floor() {
        Set<Point2i> cells = new LinkedHashSet<>();
        for (Floor floor : floorsByLevel.values()) {
            if (floor != null && floor.shape() != null) {
                cells.addAll(floor.shape().absoluteCells());
            }
        }
        return new Floor(TileShape.fromAbsoluteCells(cells));
    }

    public Floor floorAtLevel(int levelZ) {
        return floorsByLevel.getOrDefault(levelZ, new Floor(TileShape.empty()));
    }

    public Set<VertexEdge> doorEdges() {
        Set<VertexEdge> edges = new LinkedHashSet<>();
        for (Set<VertexEdge> levelEdges : doorEdgesByLevel.values()) {
            if (levelEdges != null) {
                edges.addAll(levelEdges);
            }
        }
        return Set.copyOf(edges);
    }

    public Set<VertexEdge> doorEdgesAtLevel(int levelZ) {
        return doorEdgesByLevel.getOrDefault(levelZ, Set.of());
    }

    private static Map<Integer, Floor> copyFloorsByLevel(Map<Integer, Floor> floorsByLevel) {
        if (floorsByLevel == null || floorsByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Floor> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floorsByLevel.entrySet()) {
            if (entry.getKey() != null) {
                result.put(entry.getKey(), entry.getValue() == null ? new Floor(TileShape.empty()) : entry.getValue());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, Set<VertexEdge>> copyDoorEdgesByLevel(Map<Integer, Set<VertexEdge>> doorEdgesByLevel) {
        if (doorEdgesByLevel == null || doorEdgesByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<VertexEdge>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<VertexEdge>> entry : doorEdgesByLevel.entrySet()) {
            if (entry.getKey() != null) {
                result.put(entry.getKey(), entry.getValue() == null ? Set.of() : Set.copyOf(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }
}
