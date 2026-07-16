package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

final class RoomClusterWallRows {

    private RoomClusterWallRows() {
    }

    static Map<EdgeKey, BoundaryRow> normalizeRows(Cell center, Iterable<BoundaryRow> rows) {
        Map<EdgeKey, BoundaryRow> result = new LinkedHashMap<>();
        for (BoundaryRow row : sortedRows(rows)) {
            result.putIfAbsent(keyForRow(center, row), row);
        }
        return copyRowsByKey(result);
    }

    static List<BoundaryRow> sortedRows(Iterable<BoundaryRow> rows) {
        List<BoundaryRow> result = new ArrayList<>();
        for (BoundaryRow row : rows == null ? List.<BoundaryRow>of() : rows) {
            if (row != null) {
                result.add(row);
            }
        }
        result.sort(RoomClusterWallRows::compareRows);
        return List.copyOf(result);
    }

    static Map<Integer, List<BoundaryRow>> rowsByLevel(Iterable<BoundaryRow> rows) {
        Map<Integer, List<BoundaryRow>> grouped = new LinkedHashMap<>();
        for (BoundaryRow row : sortedRows(rows)) {
            List<BoundaryRow> levelRows = grouped.get(row.level());
            if (levelRows == null) {
                levelRows = new ArrayList<>();
                grouped.put(row.level(), levelRows);
            }
            levelRows.add(row);
        }
        Map<Integer, List<BoundaryRow>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<BoundaryRow>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Collections.unmodifiableMap(result);
    }

    static EdgeKey keyForRow(@Nullable Cell center, BoundaryRow row) {
        return EdgeKey.from(absoluteEdge(center, row));
    }

    static Map<EdgeKey, BoundaryRow> copyRowsByKey(Map<EdgeKey, BoundaryRow> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<EdgeKey, BoundaryRow> result = new LinkedHashMap<>();
        for (Map.Entry<EdgeKey, BoundaryRow> entry : source.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(entry.getKey(), entry.getValue());
            }
        }
        return Collections.unmodifiableMap(result);
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
        int directionComparison = left.direction().name().compareTo(right.direction().name());
        if (directionComparison != 0) {
            return directionComparison;
        }
        return Integer.compare(kindRank(left.kind()), kindRank(right.kind()));
    }

    private static int kindRank(BoundaryKind kind) {
        return switch (kind) {
            case DOOR -> 0;
            case OPEN -> 1;
            case WALL -> 2;
        };
    }

    private static Edge absoluteEdge(@Nullable Cell center, BoundaryRow row) {
        Cell resolvedCenter = center == null ? new Cell(0, 0, row.level()) : center;
        Cell absoluteCell = new Cell(
                resolvedCenter.q() + row.relativeCell().q(),
                resolvedCenter.r() + row.relativeCell().r(),
                row.level());
        return Edge.sideOf(absoluteCell, row.direction());
    }
}
