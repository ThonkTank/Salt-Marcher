package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.stream.Stream;

public final class DungeonRuntimePresenter {

    private DungeonRuntimePresenter() {
    }

    public static String activeLocationLabel(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (layout == null || location == null) {
            return "Kein Standort";
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            return roomLabel(layout, roomLocation.roomId());
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            Corridor corridor = layout.findCorridor(corridorLocation.corridorId());
            return corridor == null ? "Korridor" : corridorLabel(layout, corridor.roomIds().stream());
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent componentLocation) {
            CorridorNetwork network = layout.corridorNetworks().stream()
                    .filter(candidate -> candidate.networkId().equals(componentLocation.componentId()))
                    .findFirst()
                    .orElse(null);
            return network == null ? "Korridor" : corridorLabel(layout, network.roomIds().stream());
        }
        return "Kein Standort";
    }

    public static String roomLabel(DungeonLayout layout, Long roomId) {
        Room room = layout == null ? null : layout.findRoom(roomId);
        if (room == null) {
            return roomId == null ? "Raum" : "Raum " + roomId;
        }
        return room.name() == null || room.name().isBlank() ? "Raum " + room.roomId() : room.name();
    }

    private static String corridorLabel(DungeonLayout layout, Stream<Long> roomIds) {
        String joinedRooms = roomIds
                .map(roomId -> roomLabel(layout, roomId))
                .distinct()
                .sorted(String::compareToIgnoreCase)
                .reduce((left, right) -> left + ", " + right)
                .orElse("Korridor");
        return "Korridor: " + joinedRooms;
    }
}
