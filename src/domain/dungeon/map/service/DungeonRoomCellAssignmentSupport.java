package src.domain.dungeon.map.service;

import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonRoomCellAssignmentSupport {

    private DungeonRoomCellAssignmentSupport() {
    }

    static void assignLevelCells(
            Map<Long, List<DungeonCell>> result,
            DungeonRoomCellProjector projector,
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
            result.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>()).add(anchor);
            return;
        }
        Set<DungeonCell> reachable = DungeonRoomCellProjector.reachableCells(anchor, unclaimedCells, barriers, cluster.center());
        reachable = reachable.isEmpty() ? Set.of(anchor) : reachable;
        unclaimedCells.removeAll(reachable);
        result.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>()).addAll(reachable);
    }
}
