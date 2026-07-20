package features.dungeon.domain.core.structure.corridor;

import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;

/** Selects an authored corridor route without coupling editor commands to an algorithm. */
public interface CorridorRoutingPolicy {

    CorridorRoute route(Cell start, Cell end, Set<Cell> blockedCells);

    CorridorRoute routeWithLevelTransition(Cell start, Cell end, Set<Cell> blockedCells);
}
