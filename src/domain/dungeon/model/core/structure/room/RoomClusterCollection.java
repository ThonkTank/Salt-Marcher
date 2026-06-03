package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.RoomClusterWork.ClusterRoomIds;

public record RoomClusterCollection(
        List<RoomClusterWork> clusters
) {
    public RoomClusterCollection {
        clusters = clusters == null ? List.of() : List.copyOf(clusters);
    }

    public RoomClusterCollection paintRectangle(Cell start, Cell end, long mapId, IdAllocation ids) {
        Set<Cell> paintedCells = RoomClusterCells.rectangle(start, end);
        if (paintedCells.isEmpty()) {
            return this;
        }
        List<RoomClusterWork> affected = affectedClustersAtLevel(start.level(), paintedCells);
        AllocationCursor idCursor = new AllocationCursor(ids);
        if (affected.isEmpty()) {
            List<RoomClusterWork> nextClusters = new ArrayList<>(clusters);
            nextClusters.add(RoomClusterWork.newClusterWork(idCursor.reserveClusterAndRoom(), mapId, paintedCells));
            return new RoomClusterCollection(nextClusters);
        }
        RoomClusterWork target = firstByClusterId(affected);
        Set<Long> affectedClusterIds = clusterIds(affected);
        List<RoomClusterWork> nextClusters = new ArrayList<>();
        for (RoomClusterWork work : clusters) {
            if (work != null && !affectedClusterIds.contains(work.cluster().clusterId())) {
                nextClusters.add(work);
            }
        }
        nextClusters.add(target.withCellsByLevel(mergedCellsByLevel(target, affected, paintedCells, start.level())));
        return new RoomClusterCollection(nextClusters);
    }

    public RoomClusterCollection deleteRectangle(Cell start, Cell end, IdAllocation ids) {
        Set<Cell> deletedCells = RoomClusterCells.rectangle(start, end);
        if (deletedCells.isEmpty()) {
            return this;
        }
        AllocationCursor idCursor = new AllocationCursor(ids);
        List<RoomClusterWork> nextClusters = new ArrayList<>();
        for (RoomClusterWork work : clusters) {
            if (!intersects(work.cellsAt(start.level()), deletedCells)) {
                nextClusters.add(work);
                continue;
            }
            addAfterDeletingLevelCells(nextClusters, work, start.level(), deletedCells, idCursor);
        }
        return new RoomClusterCollection(nextClusters);
    }

    private List<RoomClusterWork> affectedClustersAtLevel(int level, Set<Cell> cells) {
        List<RoomClusterWork> result = new ArrayList<>();
        if (cells == null || cells.isEmpty()) {
            return List.of();
        }
        for (RoomClusterWork work : clusters) {
            if (work != null && intersects(work.cellsAt(level), cells)) {
                result.add(work);
            }
        }
        return List.copyOf(result);
    }

    private void addAfterDeletingLevelCells(
            List<RoomClusterWork> nextClusters,
            RoomClusterWork work,
            int level,
            Set<Cell> deletedCells,
            AllocationCursor ids
    ) {
        Set<Cell> remainingAtLevel = new LinkedHashSet<>(work.cellsAt(level));
        remainingAtLevel.removeAll(deletedCells);
        List<Set<Cell>> components = RoomClusterCells.connectedComponents(remainingAtLevel);
        Map<Integer, List<Cell>> otherLevels = new LinkedHashMap<>(work.cellsByLevel());
        otherLevels.remove(level);
        if (components.isEmpty() && allLevelsEmpty(otherLevels)) {
            return;
        }
        if (components.isEmpty()) {
            nextClusters.add(work.withCellsByLevel(otherLevels));
            return;
        }
        addComponentsAfterDeletingLevelCells(nextClusters, work, level, components, otherLevels, ids);
    }

    private static void addComponentsAfterDeletingLevelCells(
            List<RoomClusterWork> nextClusters,
            RoomClusterWork work,
            int level,
            List<Set<Cell>> components,
            Map<Integer, List<Cell>> otherLevels,
            AllocationCursor ids
    ) {
        boolean first = true;
        for (Set<Cell> component : components) {
            Map<Integer, List<Cell>> componentCells = new LinkedHashMap<>();
            if (first) {
                componentCells.putAll(otherLevels);
                componentCells.put(level, RoomClusterCells.sortedCells(component));
                nextClusters.add(work.withCellsByLevel(componentCells));
                first = false;
                continue;
            }
            componentCells.put(level, RoomClusterCells.sortedCells(component));
            nextClusters.add(RoomClusterWork
                    .newClusterWork(ids.reserveClusterAndRoom(), work.cluster().mapId(), component)
                    .withCellsByLevel(componentCells));
        }
    }

    private static RoomClusterWork firstByClusterId(List<RoomClusterWork> affected) {
        RoomClusterWork result = null;
        for (RoomClusterWork work : affected) {
            if (work != null && (result == null || work.cluster().clusterId() < result.cluster().clusterId())) {
                result = work;
            }
        }
        if (result == null) {
            throw new IllegalStateException("affected cluster expected");
        }
        return result;
    }

    private static Set<Long> clusterIds(List<RoomClusterWork> works) {
        Set<Long> result = new LinkedHashSet<>();
        for (RoomClusterWork work : works == null ? List.<RoomClusterWork>of() : works) {
            if (work != null) {
                result.add(work.cluster().clusterId());
            }
        }
        return Set.copyOf(result);
    }

    private static Map<Integer, List<Cell>> mergedCellsByLevel(
            RoomClusterWork target,
            List<RoomClusterWork> affected,
            Set<Cell> paintedCells,
            int paintedLevel
    ) {
        Map<Integer, Set<Cell>> grouped = new LinkedHashMap<>();
        appendCellsByLevel(grouped, target.cellsByLevel());
        for (RoomClusterWork work : affected) {
            appendCellsByLevel(grouped, work.cellsByLevel());
        }
        addCellsForLevel(grouped, paintedLevel, paintedCells);
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<Cell>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), RoomClusterCells.sortedCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static void appendCellsByLevel(
            Map<Integer, Set<Cell>> target,
            Map<Integer, List<Cell>> source
    ) {
        for (Map.Entry<Integer, List<Cell>> entry : source.entrySet()) {
            addCellsForLevel(target, entry.getKey(), entry.getValue());
        }
    }

    private static void addCellsForLevel(
            Map<Integer, Set<Cell>> target,
            int level,
            Iterable<Cell> cells
    ) {
        Set<Cell> levelCells = target.get(level);
        if (levelCells == null) {
            levelCells = new LinkedHashSet<>();
            target.put(level, levelCells);
        }
        for (Cell cell : cells) {
            if (cell != null) {
                levelCells.add(cell);
            }
        }
    }

    private static boolean intersects(List<Cell> left, Set<Cell> right) {
        for (Cell cell : left == null ? List.<Cell>of() : left) {
            if (right.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    private static boolean allLevelsEmpty(Map<Integer, List<Cell>> levels) {
        for (List<Cell> cells : levels.values()) {
            if (cells != null && !cells.isEmpty()) {
                return false;
            }
        }
        return true;
    }

    public record IdAllocation(
            long nextClusterId,
            long nextRoomId
    ) {
        public IdAllocation {
            nextClusterId = Math.max(1L, nextClusterId);
            nextRoomId = Math.max(1L, nextRoomId);
        }
    }

    private static final class AllocationCursor {
        private long nextClusterId;
        private long nextRoomId;

        AllocationCursor(IdAllocation allocation) {
            IdAllocation safeAllocation = allocation == null ? new IdAllocation(1L, 1L) : allocation;
            nextClusterId = safeAllocation.nextClusterId();
            nextRoomId = safeAllocation.nextRoomId();
        }

        ClusterRoomIds reserveClusterAndRoom() {
            ClusterRoomIds reserved = new ClusterRoomIds(nextClusterId, nextRoomId);
            nextClusterId += 1L;
            nextRoomId += 1L;
            return reserved;
        }
    }
}
