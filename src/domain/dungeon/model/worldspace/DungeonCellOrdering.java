package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;

final class DungeonCellOrdering {

    private DungeonCellOrdering() {
    }

    static List<DungeonCell> sortedCells(Iterable<DungeonCell> cells) {
        List<Cell> geometryCells = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                geometryCells.add(cell.geometry());
            }
        }
        List<DungeonCell> result = new ArrayList<>();
        for (Cell cell : CellOrdering.sortedCells(geometryCells)) {
            result.add(DungeonCell.fromGeometry(cell));
        }
        return List.copyOf(result);
    }

    static int compareCells(DungeonCell left, DungeonCell right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return -1;
        }
        if (right == null) {
            return 1;
        }
        return CellOrdering.compareCells(left.geometry(), right.geometry());
    }
}
