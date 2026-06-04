package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

public final class RoomClusterBoundaryOrdering {

    private RoomClusterBoundaryOrdering() {
    }

    public static EdgeKey boundaryKey(Cell center, BoundaryRow row) {
        return EdgeKey.from(absoluteEdge(center, row));
    }

    public static Map<Integer, List<BoundaryRow>> boundariesByLevel(Iterable<BoundaryRow> rows) {
        Map<Integer, List<BoundaryRow>> grouped = new LinkedHashMap<>();
        for (BoundaryRow row : sortedRows(rows)) {
            List<BoundaryRow> levelRows = grouped.get(row.level());
            if (levelRows == null) {
                levelRows = new ArrayList<>();
                grouped.put(row.level(), levelRows);
            }
            levelRows.add(row);
        }
        return copyGroupedRows(grouped);
    }

    public static List<BoundaryRow> sortedRows(Iterable<BoundaryRow> rows) {
        List<BoundaryRow> result = new ArrayList<>();
        for (BoundaryRow row : rows == null ? List.<BoundaryRow>of() : rows) {
            if (row != null) {
                result.add(row);
            }
        }
        result.sort(RoomClusterBoundaryOrdering::compareRows);
        return List.copyOf(result);
    }

    private static int compareRows(BoundaryRow left, BoundaryRow right) {
        int levelComparison = Integer.compare(left.level(), right.level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rowComparison = Integer.compare(left.relativeCell().r(), right.relativeCell().r());
        if (rowComparison != 0) {
            return rowComparison;
        }
        int columnComparison = Integer.compare(left.relativeCell().q(), right.relativeCell().q());
        if (columnComparison != 0) {
            return columnComparison;
        }
        return left.direction().name().compareTo(right.direction().name());
    }

    private static Map<Integer, List<BoundaryRow>> copyGroupedRows(Map<Integer, List<BoundaryRow>> grouped) {
        Map<Integer, List<BoundaryRow>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<BoundaryRow>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Collections.unmodifiableMap(result);
    }

    private static Edge absoluteEdge(Cell center, BoundaryRow row) {
        Cell resolvedCenter = center == null ? new Cell(0, 0, row.level()) : center;
        Cell absoluteCell = new Cell(
                resolvedCenter.q() + row.relativeCell().q(),
                resolvedCenter.r() + row.relativeCell().r(),
                row.level());
        return Edge.sideOf(absoluteCell, row.direction());
    }

}
