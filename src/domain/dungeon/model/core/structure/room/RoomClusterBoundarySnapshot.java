package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.component.boundary.BoundaryMap;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap.WallRun;

final class RoomClusterBoundarySnapshot {
    private final Cell center;
    private final List<DungeonClusterBoundary> orderedBoundaries;

    RoomClusterBoundarySnapshot(
            Cell center,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        this.center = center == null ? new Cell(0, 0, 0) : center;
        Map<Integer, List<DungeonClusterBoundary>> copiedBoundariesByLevel =
                copyBoundariesByLevel(boundariesByLevel);
        this.orderedBoundaries = orderedBoundaries(copiedBoundariesByLevel);
    }

    Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap() {
        return new LinkedHashMap<>(copyBoundariesByKey(center, orderedBoundaries));
    }

    List<DungeonClusterBoundary> orderedBoundaries() {
        return orderedBoundaries;
    }

    List<Cell> authoredBoundaryVertices(int level) {
        RoomClusterWallMap wallMap = RoomClusterWallMap.fromKeyedRows(copyRowsByKey(center, orderedBoundaries));
        return wallMap.authoredBoundaryVertices(level);
    }

    List<WallRun> authoredWallRuns(int level) {
        RoomClusterWallMap wallMap = RoomClusterWallMap.fromKeyedRows(copyRowsByKey(center, orderedBoundaries));
        return wallMap.authoredWallRuns(level);
    }

    List<EdgeKey> adjacentWallRunEdgeKeys(Cell corner, boolean vertical) {
        BoundaryMap boundaryMap = RoomClusterBoundaryMapAdapter.boundaryMap(copyRowsByKey(center, orderedBoundaries));
        return boundaryMap.adjacentWallRunEdgeKeys(corner, vertical);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> copyBoundariesByLevel(
            Map<Integer, List<DungeonClusterBoundary>> source
    ) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        List<DungeonClusterBoundary> boundaries = new ArrayList<>();
        for (List<DungeonClusterBoundary> levelBoundaries : source.values()) {
            for (DungeonClusterBoundary boundary
                    : levelBoundaries == null ? List.<DungeonClusterBoundary>of() : levelBoundaries) {
                if (boundary != null) {
                    boundaries.add(boundary);
                }
            }
        }
        return DungeonClusterBoundary.orderedByLevel(boundaries);
    }

    private static List<DungeonClusterBoundary> orderedBoundaries(
            Map<Integer, List<DungeonClusterBoundary>> source
    ) {
        List<DungeonClusterBoundary> result = new ArrayList<>();
        for (List<DungeonClusterBoundary> boundaries
                : source == null ? List.<List<DungeonClusterBoundary>>of() : source.values()) {
            for (DungeonClusterBoundary boundary
                    : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
                if (boundary != null) {
                    result.add(boundary);
                }
            }
        }
        return List.copyOf(result);
    }

    private static Map<DungeonBoundaryKey, DungeonClusterBoundary> copyBoundariesByKey(
            Cell center,
            Iterable<DungeonClusterBoundary> boundaries
    ) {
        Map<DungeonBoundaryKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            if (boundary != null) {
                result.putIfAbsent(
                        DungeonClusterBoundary.boundaryKey(
                                RoomClusterBoundaryOrdering.boundaryKey(center, boundary.toCoreRow())),
                        boundary);
            }
        }
        return Collections.unmodifiableMap(result);
    }

    private static Map<EdgeKey, BoundaryRow> copyRowsByKey(
            Cell center,
            Iterable<DungeonClusterBoundary> boundaries
    ) {
        Map<EdgeKey, BoundaryRow> result = new LinkedHashMap<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            if (boundary != null) {
                BoundaryRow row = boundary.toCoreRow();
                result.putIfAbsent(RoomClusterWallMap.keyForRow(center, row), row);
            }
        }
        return RoomClusterWallRows.copyRowsByKey(result);
    }
}
