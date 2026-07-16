package features.dungeon.domain.core.structure.room;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;

final class RoomMutationRoomCoverage {

    private RoomMutationRoomCoverage() {
    }

    static Map<Long, List<Cell>> previousCellsByRoom(List<DungeonRoomTopologyClusterWork> works) {
        RoomCellCoverage coverage = new RoomCellCoverage();
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (DungeonRoomTopologyClusterWork work : RoomMutationWorkSets.safeClusters(works)) {
            for (Map.Entry<Long, List<Cell>> entry : coverage.cellsByRoom(work.cluster(), work.rooms()).entrySet()) {
                result.merge(entry.getKey(), entry.getValue(), RoomMutationRoomCoverage::mergedCells);
            }
        }
        return Map.copyOf(result);
    }

    static Set<Long> roomIds(List<DungeonRoom> rooms) {
        Set<Long> result = new LinkedHashSet<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room != null) {
                result.add(room.roomId());
            }
        }
        return Set.copyOf(result);
    }

    private static List<Cell> mergedCells(List<Cell> left, List<Cell> right) {
        Set<Cell> cells = new LinkedHashSet<>();
        cells.addAll(left == null ? List.of() : left);
        cells.addAll(right == null ? List.of() : right);
        return RoomClusterCells.sortedCells(cells);
    }
}
