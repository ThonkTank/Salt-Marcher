package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

final class RoomPerimeterBoundaryMaterialization {

    private RoomPerimeterBoundaryMaterialization() {
    }

    static Map<Integer, List<DungeonClusterBoundary>> fromFloorCells(
            DungeonRoomCluster cluster,
            Iterable<Cell> currentCells,
            Map<Integer, List<DungeonClusterBoundary>> preservedBoundariesByLevel
    ) {
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundariesByKey = preservedByKey(cluster, preservedBoundariesByLevel);
        for (DungeonClusterBoundary boundary : perimeterWallBoundaries(cluster, currentCells)) {
            boundariesByKey.putIfAbsent(DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center())), boundary);
        }
        return DungeonClusterBoundary.orderedByLevel(boundariesByKey.values());
    }

    private static Map<DungeonBoundaryKey, DungeonClusterBoundary> preservedByKey(
            DungeonRoomCluster cluster,
            Map<Integer, List<DungeonClusterBoundary>> preservedBoundariesByLevel
    ) {
        Map<DungeonBoundaryKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (List<DungeonClusterBoundary> boundaries : safeBoundaries(preservedBoundariesByLevel).values()) {
            for (DungeonClusterBoundary boundary : boundaries) {
                result.put(DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center())), boundary);
            }
        }
        return result;
    }

    private static List<DungeonClusterBoundary> perimeterWallBoundaries(
            DungeonRoomCluster cluster,
            Iterable<Cell> currentCells
    ) {
        Set<Cell> cells = normalizedCells(currentCells);
        List<DungeonClusterBoundary> result = new ArrayList<>();
        for (Cell cell : RoomClusterCells.sortedCells(cells)) {
            addMissingCellBoundaries(result, cluster, cells, cell);
        }
        return List.copyOf(result);
    }

    private static void addMissingCellBoundaries(
            List<DungeonClusterBoundary> result,
            DungeonRoomCluster cluster,
            Set<Cell> cells,
            Cell cell
    ) {
        for (Direction direction : Direction.values()) {
            if (!cells.contains(direction.neighborOf(cell))) {
                addBoundary(result, cluster, cells, cell, direction);
            }
        }
    }

    private static void addBoundary(
            List<DungeonClusterBoundary> result,
            DungeonRoomCluster cluster,
            Set<Cell> cells,
            Cell cell,
            Direction direction
    ) {
        BoundaryRow row = RoomClusterBoundaryMaterialization.forCells(
                cells,
                cluster.center(),
                cluster.clusterId(),
                Edge.sideOf(cell, direction),
                BoundaryKind.WALL);
        if (row != null) {
            result.add(new DungeonClusterBoundary(
                    row.clusterId(),
                    row.level(),
                    row.relativeCell(),
                    row.direction(),
                    row.kind()));
        }
    }

    private static Set<Cell> normalizedCells(Iterable<Cell> cells) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> safeBoundaries(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return boundariesByLevel == null ? Map.of() : boundariesByLevel;
    }
}
