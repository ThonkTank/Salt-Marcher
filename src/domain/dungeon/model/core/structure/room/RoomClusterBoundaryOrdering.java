package src.domain.dungeon.model.core.structure.room;

import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

public final class RoomClusterBoundaryOrdering {

    private RoomClusterBoundaryOrdering() {
    }

    public static EdgeKey boundaryKey(Cell center, BoundaryRow row) {
        return RoomClusterWallRows.keyForRow(center, row);
    }

    public static Map<Integer, List<BoundaryRow>> boundariesByLevel(Iterable<BoundaryRow> rows) {
        return RoomClusterWallRows.rowsByLevel(rows);
    }

    public static List<BoundaryRow> sortedRows(Iterable<BoundaryRow> rows) {
        return RoomClusterWallRows.sortedRows(rows);
    }

}
