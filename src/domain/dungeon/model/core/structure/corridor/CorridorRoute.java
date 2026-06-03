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

    public static CorridorRoute between(Cell start, Cell end) {
        if (start == null || end == null) {
            return new CorridorRoute(List.of());
        }
        return new CorridorRoute(Route.horizontalFirstOnStartLevel(start, end));
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
