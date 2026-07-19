package features.dungeon.application.authored.command;

import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog;

final class DungeonCommandTestIdentities {
    private static final int ROOM_RESERVATION_COUNT = 32;

    private DungeonCommandTestIdentities() {
    }

    static DungeonIdentityRange range(long firstId, int count) {
        return new DungeonIdentityRange(firstId, count);
    }

    static RoomTopologyWorkCatalog.ReservedIdentities rooms(
            long firstClusterId,
            long firstRoomId
    ) {
        return new RoomTopologyWorkCatalog().reservedIdentities(
                firstClusterId,
                ROOM_RESERVATION_COUNT,
                firstRoomId,
                ROOM_RESERVATION_COUNT);
    }

    static DungeonMap paint(
            DungeonMap map,
            Cell start,
            Cell end,
            long firstClusterId,
            long firstRoomId
    ) {
        return map.paintRoomRectangle(start, end, rooms(firstClusterId, firstRoomId));
    }

    static CreateCorridorCommand.ReservedIdentities corridor(
            long corridorId,
            long firstAnchorId,
            long stairId,
            DungeonIdentityRange stairExitIds,
            long firstClusterId,
            long firstRoomId
    ) {
        return new CreateCorridorCommand.ReservedIdentities(
                corridorId,
                range(firstAnchorId, 2),
                stairId,
                stairExitIds,
                range(firstClusterId, 8),
                range(firstRoomId, 8));
    }
}
