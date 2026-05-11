package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonRoomTopologyClusterWork;

final class DungeonRoomRectangleMutationLogic {

    private static final DungeonRoomClusterWorkLogic WORK_SERVICE = new DungeonRoomClusterWorkLogic();
    private static final DungeonRoomClusterRebuildLogic REBUILD_SERVICE = new DungeonRoomClusterRebuildLogic();
    private static final DungeonRoomCellProjection CELL_PROJECTOR = new DungeonRoomCellProjection();

    DungeonMap paintRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        Set<DungeonCell> paintedCells = rectangle(start, end);
        if (paintedCells.isEmpty()) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_SERVICE.workClusters(dungeonMap);
        List<DungeonRoomTopologyClusterWork> affected = WORK_SERVICE.affectedClusters(clusters, paintedCells);
        if (affected.isEmpty()) {
            DungeonRoomClusterWorkLogic.IdAllocation ids = WORK_SERVICE.newIdAllocation(dungeonMap);
            clusters.add(WORK_SERVICE.newClusterWork(
                    ids.reserveClusterAndRoom(),
                    dungeonMap.metadata().mapId().value(),
                    paintedCells));
            return REBUILD_SERVICE.rebuilt(dungeonMap, clusters);
        }

        DungeonRoomTopologyClusterWork target = firstByClusterId(affected);
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
        nextCells.put(start.level(), DungeonRoomCellProjection.sortedCells(targetLevelCells));
        nextClusters.add(target.withCellsByLevel(nextCells));
        return REBUILD_SERVICE.rebuilt(dungeonMap, nextClusters);
    }

    DungeonMap deleteRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        Set<DungeonCell> deletedCells = rectangle(start, end);
        if (deletedCells.isEmpty()) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_SERVICE.workClusters(dungeonMap);
        DungeonRoomClusterWorkLogic.IdAllocation ids = WORK_SERVICE.newIdAllocation(dungeonMap);
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters) {
            if (!WORK_SERVICE.intersects(work.cellsAt(start.level()), deletedCells)) {
                nextClusters.add(work);
                continue;
            }
            Set<DungeonCell> remainingAtLevel = new LinkedHashSet<>(work.cellsAt(start.level()));
            remainingAtLevel.removeAll(deletedCells);
            List<Set<DungeonCell>> components = CELL_PROJECTOR.connectedComponents(remainingAtLevel);
            Map<Integer, List<DungeonCell>> otherLevels = new LinkedHashMap<>(work.cellsByLevel());
            otherLevels.remove(start.level());
            if (components.isEmpty() && allLevelsEmpty(otherLevels)) {
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
                    componentCells.put(start.level(), DungeonRoomCellProjection.sortedCells(component));
                    nextClusters.add(work.withCellsByLevel(componentCells));
                    first = false;
                    continue;
                }
                componentCells.put(start.level(), DungeonRoomCellProjection.sortedCells(component));
                nextClusters.add(WORK_SERVICE.newClusterWork(
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

    private static DungeonRoomTopologyClusterWork firstByClusterId(List<DungeonRoomTopologyClusterWork> affected) {
        DungeonRoomTopologyClusterWork result = null;
        for (DungeonRoomTopologyClusterWork work : affected) {
            if (work != null && (result == null || work.cluster().clusterId() < result.cluster().clusterId())) {
                result = work;
            }
        }
        if (result == null) {
            throw new IllegalStateException("affected cluster expected");
        }
        return result;
    }

    private static boolean allLevelsEmpty(Map<Integer, List<DungeonCell>> levels) {
        for (List<DungeonCell> cells : levels.values()) {
            if (cells != null && !cells.isEmpty()) {
                return false;
            }
        }
        return true;
    }
}
