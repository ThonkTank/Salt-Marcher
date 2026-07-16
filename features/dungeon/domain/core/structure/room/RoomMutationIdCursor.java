package features.dungeon.domain.core.structure.room;

import java.util.List;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog.IdAllocation;

final class RoomMutationIdCursor {
    private long nextClusterId;
    private long nextRoomId;

    RoomMutationIdCursor(IdAllocation allocation) {
        IdAllocation safeAllocation = allocation == null ? new IdAllocation(1L, 1L) : allocation;
        nextClusterId = safeAllocation.nextClusterId();
        nextRoomId = safeAllocation.nextRoomId();
    }

    long reserveClusterId() {
        long clusterId = nextClusterId;
        nextClusterId += 1L;
        return clusterId;
    }

    long reserveRoomId() {
        long roomId = nextRoomId;
        nextRoomId += 1L;
        return roomId;
    }

    long nextRoomId() {
        return nextRoomId;
    }

    void observeRooms(List<DungeonRoom> rooms) {
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            nextRoomId = Math.max(nextRoomId, room.roomId() + 1L);
        }
    }
}
