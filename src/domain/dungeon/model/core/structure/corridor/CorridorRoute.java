package src.domain.dungeon.model.core.structure.corridor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Route;

public record CorridorRoute(List<Cell> cells) {

    public CorridorRoute {
        cells = cells == null ? List.of() : List.copyOf(cells);
    }

    public static CorridorRoute unblockedBetween(Cell start, Cell end, Set<Cell> blockedCells) {
        return unblockedBetween(start, end, blockedCells, true);
    }

    public static CorridorRoute unblockedBetweenWithLevelTransition(Cell start, Cell end, Set<Cell> blockedCells) {
        return unblockedBetween(start, end, blockedCells, false);
    }

    private static CorridorRoute unblockedBetween(
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

    @Override
    public List<Cell> cells() {
        return List.copyOf(cells);
    }

    public boolean present() {
        return !cells.isEmpty();
    }

    public boolean blockedBy(Set<Cell> blockedCells) {
        Set<Cell> routeCells = new LinkedHashSet<>(cells);
        Set<Cell> blocked = blockedCells == null ? Set.of() : blockedCells;
        for (Cell cell : routeCells) {
            if (blocked.contains(cell)) {
                return true;
            }
        }
        return false;
    }
}
