package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.structure.room.Room;
import src.domain.dungeon.model.core.structure.room.RoomClusterRoomPartition;

final class DungeonRoomBoundaryPartitionLogic {

    private static final DungeonRoomBoundaryPartitionAdapter PARTITION_ADAPTER =
            new DungeonRoomBoundaryPartitionAdapter();

    List<DungeonRoom> roomsForBoundaryEdit(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            DungeonRoomClusterWorkLogic.IdAllocation ids
    ) {
        List<Room> coreRooms = RoomClusterRoomPartition.roomsForBoundaryEdit(
                work.toCore(),
                PARTITION_ADAPTER.closedBoundaryEdgesByLevel(boundariesByLevel, work.cluster().center()),
                ids.nextRoomId());
        return worldspaceRooms(coreRooms, work);
    }

    private static List<DungeonRoom> worldspaceRooms(
            List<Room> coreRooms,
            DungeonRoomTopologyClusterWork previous
    ) {
        List<DungeonRoom> result = new ArrayList<>();
        for (Room room : coreRooms == null ? List.<Room>of() : coreRooms) {
            result.add(DungeonRoom.fromCore(room, narrationFor(previous, room.roomId())));
        }
        return List.copyOf(result);
    }

    private static DungeonRoomNarration narrationFor(DungeonRoomTopologyClusterWork previous, long roomId) {
        for (DungeonRoom room : previous.rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room.narration();
            }
        }
        return DungeonRoomNarration.empty();
    }
}
