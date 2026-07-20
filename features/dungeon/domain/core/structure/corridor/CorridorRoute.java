package features.dungeon.domain.core.structure.corridor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;

public record CorridorRoute(List<Cell> cells) {

    public CorridorRoute {
        cells = cells == null ? List.of() : List.copyOf(cells);
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
