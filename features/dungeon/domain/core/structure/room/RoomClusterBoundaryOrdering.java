package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

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
