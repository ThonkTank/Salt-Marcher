package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;

final class DungeonRoomClusterTopologyRebuildLogic {
    private static final DungeonRoomCellProjection CELL_PROJECTOR = new DungeonRoomCellProjection();

    DungeonRoomCluster clusterFor(DungeonRoomTopologyClusterWork work) {
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                verticesByLevel(work),
                preservedBoundaries(work));
    }

    DungeonRoomCluster clusterForStretch(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                verticesByLevel(work),
                boundariesByLevel);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> preservedBoundaries(DungeonRoomTopologyClusterWork work) {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        Map<Integer, List<Cell>> oldCellsByLevel = CELL_PROJECTOR.cellsByLevel(work.cluster(), work.rooms());
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : work.cluster().boundariesByLevel().entrySet()) {
            Set<Cell> oldCells = new LinkedHashSet<>(oldCellsByLevel.getOrDefault(entry.getKey(), List.of()));
            Set<Cell> newCells = new LinkedHashSet<>(work.cellsByLevel().getOrDefault(entry.getKey(), List.of()));
            List<DungeonClusterBoundary> preserved = new ArrayList<>();
            for (DungeonClusterBoundary boundary : entry.getValue()) {
                if (boundary != null && keepBoundary(work.cluster(), boundary, oldCells, newCells)) {
                    preserved.add(boundary);
                }
            }
            if (!preserved.isEmpty()) {
                result.put(entry.getKey(), preserved);
            }
        }
        return Map.copyOf(result);
    }

    private static boolean keepBoundary(
            DungeonRoomCluster cluster,
            DungeonClusterBoundary boundary,
            Set<Cell> oldCells,
            Set<Cell> newCells
    ) {
        Cell cell = boundary.absoluteCell(cluster.center());
        if (!newCells.contains(cell)) {
            return false;
        }
        Cell neighbor = boundary.direction().neighborOf(cell);
        if (!newCells.contains(neighbor)) {
            return true;
        }
        return boundary.isDoor() || oldCells.contains(cell) && oldCells.contains(neighbor);
    }

    private static Map<Integer, List<Cell>> verticesByLevel(DungeonRoomTopologyClusterWork work) {
        Map<Integer, List<Cell>> verticesByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : work.cellsByLevel().entrySet()) {
            if (!entry.getValue().isEmpty()) {
                verticesByLevel.put(
                        entry.getKey(),
                        CELL_PROJECTOR.relativeCellLoops(work.cluster().center(), entry.getValue()));
            }
        }
        return Map.copyOf(verticesByLevel);
    }
}
