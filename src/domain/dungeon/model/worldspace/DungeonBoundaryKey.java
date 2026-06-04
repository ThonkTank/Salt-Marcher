package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.EdgeKey;

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
        return DungeonCellOrdering.compareCells(left, right);
    }

    private static Cell coreCell(DungeonCell cell) {
        return cell == null ? null : cell.geometry();
    }
}
