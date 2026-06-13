package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.component.boundary.BoundaryMap;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap.WallRun;

final class RoomClusterBoundarySnapshot {
    private final Cell center;
    private final Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel;
    private final List<DungeonClusterBoundary> orderedBoundaries;

    RoomClusterBoundarySnapshot(
            Cell center,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        this.center = center == null ? new Cell(0, 0, 0) : center;
        this.boundariesByLevel = DungeonClusterBoundary.orderedByLevel(flattenBoundaries(boundariesByLevel));
        List<DungeonClusterBoundary> ordered = new ArrayList<>();
        for (List<DungeonClusterBoundary> boundaries : this.boundariesByLevel.values()) {
            ordered.addAll(boundaries);
        }
        this.orderedBoundaries = List.copyOf(ordered);
    }

    Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap() {
        return new LinkedHashMap<>(copyBoundariesByKey(center, orderedBoundaries));
    }

    List<DungeonClusterBoundary> orderedBoundaries() {
        return orderedBoundaries;
    }

    Set<Integer> boundaryLevels() {
        return Collections.unmodifiableSet(new LinkedHashSet<>(boundariesByLevel.keySet()));
    }

    Map<Integer, List<Edge>> closedBoundaryEdgesByLevel() {
        return DungeonRoomBoundaryPartition.closedBoundaryEdgesByLevel(boundariesByLevel, center);
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

    private static List<DungeonClusterBoundary> flattenBoundaries(
            Map<Integer, List<DungeonClusterBoundary>> source
    ) {
        if (source == null || source.isEmpty()) {
            return List.of();
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
        return List.copyOf(boundaries);
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
