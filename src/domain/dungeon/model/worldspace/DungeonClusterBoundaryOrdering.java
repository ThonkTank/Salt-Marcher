package src.domain.dungeon.model.worldspace;

import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryOrdering;

final class DungeonClusterBoundaryOrdering {

    private DungeonClusterBoundaryOrdering() {
    }

    static Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap(DungeonRoomCluster cluster) {
        Map<BoundaryRow, Queue<DungeonClusterBoundary>> boundariesByRow = boundariesByRow(flatten(
                cluster == null ? null : cluster.boundariesByLevel()));
        List<BoundaryRow> orderedRows = RoomClusterBoundaryOrdering.sortedRows(boundariesByRow.keySet());
        Map<DungeonBoundaryKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (BoundaryRow row : orderedRows) {
            DungeonBoundaryKey key = dungeonKey(RoomClusterBoundaryOrdering.boundaryKey(
                    cluster == null ? null : cluster.center().geometry(),
                    row));
            Queue<DungeonClusterBoundary> rowBoundaries = boundariesByRow.get(row);
            while (rowBoundaries != null && !rowBoundaries.isEmpty()) {
                result.put(key, rowBoundaries.remove());
            }
        }
        return result;
    }

    static Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel(Iterable<DungeonClusterBoundary> boundaries) {
        return orderedBoundariesByLevel(boundaries);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> orderedBoundariesByLevel(
            Iterable<DungeonClusterBoundary> boundaries
    ) {
        Map<BoundaryRow, Queue<DungeonClusterBoundary>> boundariesByRow = boundariesByRow(boundaries);
        Map<Integer, List<BoundaryRow>> coreRowsByLevel =
                RoomClusterBoundaryOrdering.boundariesByLevel(boundariesByRow.keySet());
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<BoundaryRow>> entry : coreRowsByLevel.entrySet()) {
            List<DungeonClusterBoundary> levelBoundaries = new java.util.ArrayList<>();
            for (BoundaryRow row : entry.getValue()) {
                Queue<DungeonClusterBoundary> rowBoundaries = boundariesByRow.get(row);
                while (rowBoundaries != null && !rowBoundaries.isEmpty()) {
                    levelBoundaries.add(rowBoundaries.remove());
                }
            }
            result.put(entry.getKey(), List.copyOf(levelBoundaries));
        }
        return Map.copyOf(result);
    }

    private static Map<BoundaryRow, Queue<DungeonClusterBoundary>> boundariesByRow(
            Iterable<DungeonClusterBoundary> boundaries
    ) {
        Map<BoundaryRow, Queue<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            if (boundary == null) {
                continue;
            }
            BoundaryRow row = coreRow(boundary);
            Queue<DungeonClusterBoundary> rowBoundaries = result.get(row);
            if (rowBoundaries == null) {
                rowBoundaries = new ArrayDeque<>();
                result.put(row, rowBoundaries);
            }
            rowBoundaries.add(boundary);
        }
        return result;
    }

    private static List<DungeonClusterBoundary> flatten(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        List<DungeonClusterBoundary> result = new java.util.ArrayList<>();
        for (List<DungeonClusterBoundary> boundaries
                : boundariesByLevel == null ? List.<List<DungeonClusterBoundary>>of() : boundariesByLevel.values()) {
            result.addAll(boundaries);
        }
        return List.copyOf(result);
    }

    private static BoundaryRow coreRow(DungeonClusterBoundary boundary) {
        return new BoundaryRow(
                boundary.clusterId(),
                boundary.level(),
                boundary.relativeCell().geometry(),
                boundary.direction().geometry(),
                coreKind(boundary.kind()));
    }

    private static BoundaryKind coreKind(DungeonClusterBoundaryKind kind) {
        if (kind == DungeonClusterBoundaryKind.DOOR) {
            return BoundaryKind.DOOR;
        }
        if (kind == DungeonClusterBoundaryKind.OPEN) {
            return BoundaryKind.OPEN;
        }
        return BoundaryKind.WALL;
    }

    private static DungeonBoundaryKey dungeonKey(EdgeKey key) {
        return new DungeonBoundaryKey(
                DungeonCell.fromGeometry(key.lower()),
                DungeonCell.fromGeometry(key.upper()));
    }
}
