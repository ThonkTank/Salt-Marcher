package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;

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
        Floor floor,
        Map<Integer, Floor> floorsByLevel,
        Set<VertexEdge> doorEdges,
        Map<Integer, Set<VertexEdge>> doorEdgesByLevel,
        boolean directlyAdjacent,
        boolean routable
) {
    public CorridorPath {
        route = route == null ? GridRoute.empty() : route;
        floor = floor == null ? new Floor(TileShape.empty()) : floor;
        floorsByLevel = floorsByLevel == null ? Map.of() : Map.copyOf(floorsByLevel);
        doorEdges = doorEdges == null ? Set.of() : Set.copyOf(doorEdges);
        doorEdgesByLevel = doorEdgesByLevel == null ? Map.of() : Map.copyOf(doorEdgesByLevel);
    }

    public static CorridorPath empty() {
        return new CorridorPath(
                GridRoute.empty(),
                new Floor(TileShape.empty()),
                Map.of(),
                Set.of(),
                Map.of(),
                false,
                false);
    }

    public static CorridorPath unroutable(GridRoute route) {
        return new CorridorPath(
                route,
                new Floor(TileShape.empty()),
                Map.of(),
                Set.of(),
                Map.of(),
                false,
                false);
    }
}
