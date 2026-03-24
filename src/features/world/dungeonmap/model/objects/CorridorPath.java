package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Runtime-owned routed connection structure for one corridor.
 *
 * <p>The canonical editable truth lives on corridor bindings. This object only carries the currently resolved
 * routed shape that connectivity planning produced for runtime use and rendering.</p>
 */
public record CorridorPath(
        GridRoute route,
        Map<Integer, Floor> floorsByLevel,
        boolean directlyAdjacent,
        boolean routable
) {
    public CorridorPath {
        route = route == null ? GridRoute.empty() : route;
        floorsByLevel = copyFloorsByLevel(floorsByLevel);
    }

    public static CorridorPath empty() {
        return new CorridorPath(
                GridRoute.empty(),
                Map.of(),
                false,
                false);
    }

    public static CorridorPath unroutable(GridRoute route) {
        return new CorridorPath(
                route,
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
}
