package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.cluster.model.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.connection.DoorExitCatalog;

import java.util.List;

final class RoomRuntimeDescriptionBuilder {

    private RoomRuntimeDescriptionBuilder() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeDescription build(DungeonRuntimeLocation location) {
        DungeonLayout layout = location == null ? null : location.layout();
        Room room = location == null ? null : location.room();
        if (layout == null || room == null || room.roomId() == null) {
            return null;
        }
        RoomCluster cluster = layout.findCluster(room.clusterId());
        if (cluster == null) {
            return null;
        }
        List<DungeonRuntimeExit> exits = cluster.structure().roomTopology().roomLevels(room).stream()
                .sorted()
                .flatMap(levelZ -> DoorExitCatalog.describe(
                        layout,
                        cluster.structure().roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().cellCoords(),
                        levelZ,
                        layout.connectionsForEndpoint(ConnectionEndpoint.room(room.roomId()))).stream())
                .map(exit -> DungeonRuntimeExitFactory.roomExit(location, exit))
                .filter(java.util.Objects::nonNull)
                .toList();
        return new DungeonRuntimeDescription(
                roomLabel(room),
                location.ownerRef(),
                room.narration().visualDescription(),
                exits);
    }

    private static String roomLabel(Room room) {
        if (room == null) {
            return "Raum";
        }
        return room.name() == null || room.name().isBlank() ? "Raum " + room.roomId() : room.name();
    }
}
