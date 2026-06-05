package src.domain.dungeon.model.core.geometry;

import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonEdge;

public record DungeonBoundaryKey(
        DungeonCell lower,
        DungeonCell upper
) {

    public static DungeonBoundaryKey from(DungeonEdge edge) {
        DungeonCell from = edge.from();
        DungeonCell to = edge.to();
        int comparison = compareCells(from, to);
        return comparison <= 0 ? new DungeonBoundaryKey(from, to) : new DungeonBoundaryKey(to, from);
    }

    public long stableId() {
        return new EdgeKey(coreCell(lower), coreCell(upper)).stableId();
    }

    private static int compareCells(DungeonCell left, DungeonCell right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return -1;
        }
        if (right == null) {
            return 1;
        }
        return CellOrdering.compareCells(coreCell(left), coreCell(right));
    }

    private static Cell coreCell(DungeonCell cell) {
        return cell == null ? null : new Cell(cell.q(), cell.r(), cell.level());
    }
}
