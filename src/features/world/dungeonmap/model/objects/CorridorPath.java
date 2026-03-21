package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.List;

/**
 * Runtime-owned resolved corridor path object.
 *
 * <p>CorridorPath owns the current route intent, resolved corridor floor, and resolved corridor doors for one
 * corridor. The canonical editable truth still lives in the corridor structure bindings.</p>
 */
public record CorridorPath(
        GridRoute route,
        Floor floor,
        List<Door> doors,
        boolean directlyAdjacent,
        boolean routable
) {
    public CorridorPath {
        route = route == null ? GridRoute.empty() : route;
        floor = floor == null ? new Floor(TileShape.empty()) : floor;
        doors = doors == null ? List.of() : List.copyOf(doors);
    }

    public static CorridorPath empty() {
        return new CorridorPath(GridRoute.empty(), new Floor(TileShape.empty()), List.of(), false, false);
    }

    public static CorridorPath empty(GridRoute route) {
        return new CorridorPath(route, new Floor(TileShape.empty()), List.of(), false, false);
    }

    public CorridorPath withRoute(GridRoute route) {
        return new CorridorPath(route, floor, doors, directlyAdjacent, routable);
    }

    public CorridorPath withFloor(Floor floor) {
        return new CorridorPath(route, floor, doors, directlyAdjacent, routable);
    }

    public CorridorPath withDoors(List<Door> doors) {
        return new CorridorPath(route, floor, doors, directlyAdjacent, routable);
    }

    public CorridorPath withRuntimeGeometry(Floor floor, List<Door> doors, boolean directlyAdjacent, boolean routable) {
        return new CorridorPath(route, floor, doors, directlyAdjacent, routable);
    }
}
