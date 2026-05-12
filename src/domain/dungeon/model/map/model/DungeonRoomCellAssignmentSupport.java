package src.domain.dungeon.model.map.model;


import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonRoomCellAssignmentSupport {

    private static final DungeonCellTraversalSupport TRAVERSAL_SUPPORT = new DungeonCellTraversalSupport();

    private DungeonRoomCellAssignmentSupport() {
    }

    static void assignLevelCells(
            Map<Long, List<DungeonCell>> result,
            DungeonRoomCellProjection projector,
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms,
            int level
    ) {
        Set<DungeonCell> clusterCells = new LinkedHashSet<>(projector.clusterCells(cluster, rooms, level));
        Set<DungeonCell> unclaimedCells = new LinkedHashSet<>(clusterCells);
        List<DungeonClusterBoundary> barriers = cluster.boundariesByLevel().getOrDefault(level, List.of());
        for (DungeonRoom room : rooms) {
            claimRoomCells(result, cluster, room, level, clusterCells, unclaimedCells, barriers);
        }
    }

    private static void claimRoomCells(
            Map<Long, List<DungeonCell>> result,
            DungeonRoomCluster cluster,
            DungeonRoom room,
            int level,
            Set<DungeonCell> clusterCells,
            Set<DungeonCell> unclaimedCells,
            List<DungeonClusterBoundary> barriers
    ) {
        DungeonCell anchor = room.floorAnchors().get(level);
        if (anchor == null) {
            return;
        }
        if (!clusterCells.contains(anchor)) {
            clusterCells.add(anchor);
            unclaimedCells.add(anchor);
        } else if (!unclaimedCells.contains(anchor)) {
            roomCells(result, room.roomId()).add(anchor);
            return;
        }
        Set<DungeonCell> reachable = TRAVERSAL_SUPPORT.reachableCells(anchor, unclaimedCells, barriers, cluster.center());
        reachable = reachable.isEmpty() ? Set.of(anchor) : reachable;
        unclaimedCells.removeAll(reachable);
        roomCells(result, room.roomId()).addAll(reachable);
    }

    private static List<DungeonCell> roomCells(Map<Long, List<DungeonCell>> result, long roomId) {
        List<DungeonCell> cells = result.get(roomId);
        if (cells == null) {
            cells = new ArrayList<>();
            result.put(roomId, cells);
        }
        return cells;
    }
}
