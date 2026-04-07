package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.cluster.model.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.structure.model.Structure;

import java.util.List;

final class CorridorRuntimeDescriptionBuilder {

    private CorridorRuntimeDescriptionBuilder() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeDescription build(DungeonRuntimeLocation location) {
        DungeonLayout layout = location == null ? null : location.layout();
        Corridor corridor = location == null ? null : location.corridor();
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return null;
        }
        List<DungeonRuntimeExit> exits = layout.describeCorridorExits(corridor).stream()
                .map(exit -> DungeonRuntimeExitFactory.corridorExit(location, exit))
                .filter(java.util.Objects::nonNull)
                .toList();
        return new DungeonRuntimeDescription(
                corridorLabel(layout, corridor),
                location.ownerRef(),
                "",
                exits);
    }

    private static String corridorLabel(DungeonLayout layout, Corridor corridor) {
        if (corridor == null) {
            return "Korridor";
        }
        String joinedRooms = corridor.connectedRoomIds().stream()
                .map(roomId -> roomLabel(layout, roomId))
                .distinct()
                .sorted(String::compareToIgnoreCase)
                .reduce((left, right) -> left + ", " + right)
                .orElse("Korridor");
        return "Korridor: " + joinedRooms;
    }

    private static String roomLabel(DungeonLayout layout, Long roomId) {
        if (roomId == null) {
            return "Raum";
        }
        Room room = layout == null ? null : layout.clusters().stream()
                .map(RoomCluster::structure)
                .map(Structure::roomTopology)
                .map(topology -> topology.findRoom(roomId))
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
        return room == null || room.name() == null || room.name().isBlank() ? "Raum " + roomId : room.name();
    }
}
