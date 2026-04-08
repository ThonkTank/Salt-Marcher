package features.world.dungeon.application.runtime.description;

import features.world.dungeon.application.runtime.DungeonRuntimeLocation;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.connections.input.ConnectionEndpoint;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.dungeonmap.connections.input.DoorExitCatalog;

import java.util.List;

final class RoomRuntimeDescriptionBuilder {

    private RoomRuntimeDescriptionBuilder() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeDescription build(DungeonRuntimeLocation location) {
        DungeonMap layout = location == null ? null : location.layout();
        Room room = location == null ? null : location.room();
        if (layout == null || room == null || room.roomId() == null) {
            return null;
        }
        Cluster cluster = layout.findCluster(room.clusterId());
        if (cluster == null) {
            return null;
        }
        List<DungeonRuntimeExit> exits = cluster.roomTopology().roomLevels(room).stream()
                .sorted()
                .flatMap(levelZ -> DoorExitCatalog.describe(
                        layout,
                        cluster.roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().cellFootprint(),
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
