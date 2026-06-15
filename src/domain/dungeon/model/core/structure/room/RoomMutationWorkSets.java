package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;

final class RoomMutationWorkSets {

    private RoomMutationWorkSets() {
    }

    static List<DungeonRoomTopologyClusterWork> affectedClustersAtLevel(
            List<DungeonRoomTopologyClusterWork> clusters,
            int level,
            Set<Cell> cells
    ) {
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : safeClusters(clusters)) {
            if (intersects(RoomMutationCellMaps.cellsAt(work, level), cells)) {
                result.add(work);
            }
        }
        return List.copyOf(result);
    }

    static DungeonRoomTopologyClusterWork firstByClusterId(List<DungeonRoomTopologyClusterWork> affected) {
        DungeonRoomTopologyClusterWork result = null;
        for (DungeonRoomTopologyClusterWork work : safeClusters(affected)) {
            if (result == null || work.cluster().clusterId() < result.cluster().clusterId()) {
                result = work;
            }
        }
        if (result == null) {
            throw new IllegalStateException("affected cluster expected");
        }
        return result;
    }

    static List<DungeonRoomTopologyClusterWork> replaceAffectedWith(
            List<DungeonRoomTopologyClusterWork> clusters,
            Set<Long> affectedClusterIds,
            DungeonRoomTopologyClusterWork replacement
    ) {
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : safeClusters(clusters)) {
            if (!affectedClusterIds.contains(work.cluster().clusterId())) {
                result.add(work);
            }
        }
        result.add(replacement);
        return List.copyOf(result);
    }

    static List<DungeonRoomTopologyClusterWork> appendCluster(
            List<DungeonRoomTopologyClusterWork> clusters,
            DungeonRoomTopologyClusterWork created
    ) {
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>(safeClusters(clusters));
        result.add(created);
        return List.copyOf(result);
    }

    static Set<Long> clusterIds(List<DungeonRoomTopologyClusterWork> works) {
        Set<Long> result = new LinkedHashSet<>();
        for (DungeonRoomTopologyClusterWork work : safeClusters(works)) {
            result.add(work.cluster().clusterId());
        }
        return Set.copyOf(result);
    }

    static Map<Integer, List<Cell>> mergedCellsByLevel(
            DungeonRoomTopologyClusterWork target,
            List<DungeonRoomTopologyClusterWork> affected,
            Set<Cell> paintedCells,
            int paintedLevel
    ) {
        Map<Integer, Set<Cell>> grouped = new LinkedHashMap<>();
        RoomMutationCellMaps.appendCellsByLevel(grouped, target.cellsByLevel());
        for (DungeonRoomTopologyClusterWork work : affected) {
            RoomMutationCellMaps.appendCellsByLevel(grouped, work.cellsByLevel());
        }
        RoomMutationCellMaps.addCellsForLevel(grouped, paintedLevel, paintedCells);
        return RoomMutationCellMaps.sortedCellsByLevel(grouped);
    }

    static boolean intersects(List<Cell> left, Set<Cell> right) {
        for (Cell cell : left == null ? List.<Cell>of() : left) {
            if (right.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    static List<DungeonRoomTopologyClusterWork> safeClusters(List<DungeonRoomTopologyClusterWork> clusters) {
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters == null
                ? List.<DungeonRoomTopologyClusterWork>of()
                : clusters) {
            if (work != null && work.cluster() != null) {
                result.add(work);
            }
        }
        return List.copyOf(result);
    }

}
