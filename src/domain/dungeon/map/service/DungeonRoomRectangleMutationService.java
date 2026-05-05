package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;

final class DungeonRoomRectangleMutationService {

    private static final DungeonRoomClusterRebuildService REBUILD_SERVICE = new DungeonRoomClusterRebuildService();
    private static final DungeonRoomCellProjector CELL_PROJECTOR = new DungeonRoomCellProjector();

    DungeonMap paintRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        Set<DungeonCell> paintedCells = rectangle(start, end);
        if (paintedCells.isEmpty()) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = REBUILD_SERVICE.workClusters(dungeonMap);
        List<DungeonRoomTopologyClusterWork> affected = REBUILD_SERVICE.affectedClusters(clusters, paintedCells);
        if (affected.isEmpty()) {
            DungeonRoomClusterRebuildService.IdAllocation ids = REBUILD_SERVICE.newIdAllocation(dungeonMap);
            clusters.add(REBUILD_SERVICE.newClusterWork(
                    ids.reserveClusterAndRoom(),
                    dungeonMap.metadata().mapId().value(),
                    paintedCells));
            return REBUILD_SERVICE.rebuilt(dungeonMap, clusters);
        }

        DungeonRoomTopologyClusterWork target = affected.stream()
                .min(Comparator.comparingLong(work -> work.cluster().clusterId()))
                .orElseThrow();
        Set<DungeonCell> targetLevelCells = new LinkedHashSet<>(target.cellsAt(start.level()));
        targetLevelCells.addAll(paintedCells);
        for (DungeonRoomTopologyClusterWork work : affected) {
            targetLevelCells.addAll(work.cellsAt(start.level()));
        }
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters) {
            if (!affected.contains(work)) {
                nextClusters.add(work);
            }
        }
        Map<Integer, List<DungeonCell>> nextCells = new LinkedHashMap<>(target.cellsByLevel());
        nextCells.put(start.level(), DungeonRoomCellProjector.sortedCells(targetLevelCells));
        nextClusters.add(target.withCellsByLevel(nextCells));
        return REBUILD_SERVICE.rebuilt(dungeonMap, nextClusters);
    }

    DungeonMap deleteRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        Set<DungeonCell> deletedCells = rectangle(start, end);
        if (deletedCells.isEmpty()) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = REBUILD_SERVICE.workClusters(dungeonMap);
        DungeonRoomClusterRebuildService.IdAllocation ids = REBUILD_SERVICE.newIdAllocation(dungeonMap);
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters) {
            if (!REBUILD_SERVICE.intersects(work.cellsAt(start.level()), deletedCells)) {
                nextClusters.add(work);
                continue;
            }
            Set<DungeonCell> remainingAtLevel = new LinkedHashSet<>(work.cellsAt(start.level()));
            remainingAtLevel.removeAll(deletedCells);
            List<Set<DungeonCell>> components = CELL_PROJECTOR.connectedComponents(remainingAtLevel);
            Map<Integer, List<DungeonCell>> otherLevels = new LinkedHashMap<>(work.cellsByLevel());
            otherLevels.remove(start.level());
            if (components.isEmpty() && otherLevels.values().stream().allMatch(List::isEmpty)) {
                continue;
            }
            if (components.isEmpty()) {
                nextClusters.add(work.withCellsByLevel(otherLevels));
                continue;
            }
            boolean first = true;
            for (Set<DungeonCell> component : components) {
                Map<Integer, List<DungeonCell>> componentCells = new LinkedHashMap<>();
                if (first) {
                    componentCells.putAll(otherLevels);
                    componentCells.put(start.level(), DungeonRoomCellProjector.sortedCells(component));
                    nextClusters.add(work.withCellsByLevel(componentCells));
                    first = false;
                    continue;
                }
                componentCells.put(start.level(), DungeonRoomCellProjector.sortedCells(component));
                nextClusters.add(REBUILD_SERVICE.newClusterWork(
                        ids.reserveClusterAndRoom(),
                        work.cluster().mapId(),
                        component).withCellsByLevel(componentCells));
            }
        }
        return REBUILD_SERVICE.rebuilt(dungeonMap, nextClusters);
    }

    private static Set<DungeonCell> rectangle(DungeonCell start, DungeonCell end) {
        if (start == null || end == null) {
            return Set.of();
        }
        int level = start.level();
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        Set<DungeonCell> cells = new LinkedHashSet<>();
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                cells.add(new DungeonCell(q, r, level));
            }
        }
        return Set.copyOf(cells);
    }
}
