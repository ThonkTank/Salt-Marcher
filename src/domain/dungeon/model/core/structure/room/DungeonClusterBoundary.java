package src.domain.dungeon.model.core.structure.room;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

public record DungeonClusterBoundary(
        long clusterId,
        int level,
        Cell relativeCell,
        Direction direction,
        BoundaryKind kind,
        DungeonTopologyRef topologyRef
) {

    public DungeonClusterBoundary(
            long clusterId,
            int level,
            Cell relativeCell,
            Direction direction,
            BoundaryKind kind
    ) {
        this(clusterId, level, relativeCell, direction, kind, DungeonTopologyRef.empty());
    }

    public DungeonClusterBoundary {
        relativeCell = relativeCell == null ? new Cell(0, 0, level) : relativeCell;
        direction = direction == null ? Direction.NORTH : direction;
        kind = kind == null ? BoundaryKind.WALL : kind;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public Cell absoluteCell(Cell center) {
        Cell resolvedCenter = center == null ? new Cell(0, 0, level) : center;
        return new Cell(
                resolvedCenter.q() + relativeCell.q(),
                resolvedCenter.r() + relativeCell.r(),
                level);
    }

    public Edge absoluteEdge(Cell center) {
        return Edge.sideOf(absoluteCell(center), direction);
    }

    public boolean isDoor() {
        return kind == BoundaryKind.DOOR;
    }

    public boolean isOpen() {
        return kind == BoundaryKind.OPEN;
    }

    public boolean matchesAbsoluteEdge(Cell center, Edge edge) {
        return edge != null && DungeonBoundaryKey.from(absoluteEdge(center)).equals(DungeonBoundaryKey.from(edge));
    }

    public DungeonTopologyRef resolvedTopologyRef(Cell center) {
        if (isOpen()) {
            return DungeonTopologyRef.empty();
        }
        if (topologyRef.present()) {
            return topologyRef;
        }
        long boundaryId = DungeonBoundaryKey.from(absoluteEdge(center)).stableId();
        return isDoor() ? DungeonTopologyRef.door(boundaryId) : DungeonTopologyRef.wall(boundaryId);
    }

    public static Map<Integer, List<DungeonClusterBoundary>> orderedByLevel(
            Iterable<DungeonClusterBoundary> boundaries
    ) {
        Map<BoundaryRow, List<DungeonClusterBoundary>> boundariesByRow = boundariesByRow(boundaries);
        Map<Integer, List<BoundaryRow>> coreRowsByLevel =
                RoomClusterBoundaryOrdering.boundariesByLevel(boundariesByRow.keySet());
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<BoundaryRow>> entry : coreRowsByLevel.entrySet()) {
            result.put(entry.getKey(), orderedBoundariesForRows(boundariesByRow, entry.getValue()));
        }
        return Collections.unmodifiableMap(result);
    }

    public static Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap(
            Cell center,
            Iterable<DungeonClusterBoundary> boundaries
    ) {
        Map<BoundaryRow, List<DungeonClusterBoundary>> boundariesByRow = boundariesByRow(boundaries);
        List<BoundaryRow> orderedRows = RoomClusterBoundaryOrdering.sortedRows(boundariesByRow.keySet());
        Map<DungeonBoundaryKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (BoundaryRow row : orderedRows) {
            DungeonBoundaryKey key = boundaryKey(RoomClusterBoundaryOrdering.boundaryKey(center, row));
            for (DungeonClusterBoundary boundary : boundariesByRow.getOrDefault(row, List.of())) {
                result.put(key, boundary);
            }
        }
        return result;
    }

    private static Map<BoundaryRow, List<DungeonClusterBoundary>> boundariesByRow(
            Iterable<DungeonClusterBoundary> boundaries
    ) {
        Map<BoundaryRow, List<DungeonClusterBoundary>> mutableRows = new LinkedHashMap<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            if (boundary == null) {
                continue;
            }
            BoundaryRow row = boundary.toCoreRow();
            List<DungeonClusterBoundary> rowBoundaries = mutableRows.get(row);
            if (rowBoundaries == null) {
                rowBoundaries = new java.util.ArrayList<>();
                mutableRows.put(row, rowBoundaries);
            }
            rowBoundaries.add(boundary);
        }
        Map<BoundaryRow, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<BoundaryRow, List<DungeonClusterBoundary>> entry : mutableRows.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return result;
    }

    BoundaryRow toCoreRow() {
        return new BoundaryRow(
                clusterId,
                level,
                relativeCell,
                direction,
                kind);
    }

    static DungeonBoundaryKey boundaryKey(EdgeKey key) {
        return new DungeonBoundaryKey(
                key.lower(),
                key.upper());
    }

    private static List<DungeonClusterBoundary> orderedBoundariesForRows(
            Map<BoundaryRow, List<DungeonClusterBoundary>> boundariesByRow,
            List<BoundaryRow> rows
    ) {
        List<DungeonClusterBoundary> result = new java.util.ArrayList<>();
        for (BoundaryRow row : rows) {
            result.addAll(boundariesByRow.getOrDefault(row, List.of()));
        }
        return List.copyOf(result);
    }
}
