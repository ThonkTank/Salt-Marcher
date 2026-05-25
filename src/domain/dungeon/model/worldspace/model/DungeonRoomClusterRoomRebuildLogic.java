package src.domain.dungeon.model.worldspace.model;

import java.util.List;

final class DungeonRoomClusterRoomRebuildLogic {
    List<DungeonRoom> roomsFor(DungeonRoomTopologyClusterWork work) {
        DungeonRoom template = work.rooms().isEmpty() ? null : work.rooms().getFirst();
        List<DungeonCell> sortedCells = DungeonCellOrdering.sortedCells(work.allCells());
        DungeonCell anchor = sortedCells.isEmpty() ? null : sortedCells.getFirst();
        if (anchor == null) {
            return List.of();
        }
        long roomId = template == null ? nextRoomId(work.cluster(), work.rooms()) : template.roomId();
        return List.of(new DungeonRoom(
                roomId,
                work.cluster().mapId(),
                work.cluster().clusterId(),
                template == null ? "Raum " + roomId : template.name(),
                DungeonRoomCellProjection.anchorsByLevel(work.cellsByLevel()),
                template == null ? DungeonRoomNarration.empty() : template.narration()));
    }

    private static long nextRoomId(DungeonRoomCluster cluster, List<DungeonRoom> rooms) {
        long result = 0L;
        boolean found = false;
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room != null && (!found || room.roomId() < result)) {
                result = room.roomId();
                found = true;
            }
        }
        return found ? result : Math.max(1L, cluster.clusterId());
    }
}
