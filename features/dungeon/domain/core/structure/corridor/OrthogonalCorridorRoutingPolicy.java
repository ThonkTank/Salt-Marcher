package features.dungeon.domain.core.structure.corridor;

import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Route;

/** Deterministic horizontal-first, vertical-fallback routing used by the initial product. */
public final class OrthogonalCorridorRoutingPolicy implements CorridorRoutingPolicy {

    @Override
    public CorridorRoute route(Cell start, Cell end, Set<Cell> blockedCells) {
        return route(start, end, blockedCells, true);
    }

    @Override
    public CorridorRoute routeWithLevelTransition(Cell start, Cell end, Set<Cell> blockedCells) {
        return route(start, end, blockedCells, false);
    }

    private static CorridorRoute route(
            Cell start,
            Cell end,
            Set<Cell> blockedCells,
            boolean keepStartLevel
    ) {
        if (start == null || end == null) {
            return new CorridorRoute(List.of());
        }
        Set<Cell> blocked = blockedCells == null ? Set.of() : blockedCells;
        CorridorRoute horizontalFirst = new CorridorRoute(keepStartLevel
                ? Route.horizontalFirstOnStartLevel(start, end)
                : Route.horizontalFirst(start, end));
        if (!horizontalFirst.blockedBy(blocked)) {
            return horizontalFirst;
        }
        CorridorRoute verticalFirst = new CorridorRoute(keepStartLevel
                ? Route.verticalFirstOnStartLevel(start, end)
                : Route.verticalFirst(start, end));
        return verticalFirst.blockedBy(blocked) ? new CorridorRoute(List.of()) : verticalFirst;
    }
}
