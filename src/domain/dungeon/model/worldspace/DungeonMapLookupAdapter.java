package src.domain.dungeon.model.worldspace;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

/**
 * Transitional adapter while authored map aggregate carriers still live in worldspace.
 *
 * <p>Delete this adapter when the productive corridor callers consume the core
 * aggregate owner directly or when `DungeonMap` and its contained authored
 * carriers have moved out of `worldspace`.
 */
final class DungeonMapLookupAdapter {

    @Nullable DungeonRoom room(DungeonMap dungeonMap, long roomId) {
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room;
            }
        }
        return null;
    }

    @Nullable DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null && cluster.clusterId() == clusterId) {
                return cluster;
            }
        }
        return null;
    }

    @Nullable Corridor corridor(DungeonMap dungeonMap, long corridorId) {
        for (Corridor candidate : dungeonMap.corridors()) {
            if (candidate != null && candidate.corridorId() == corridorId) {
                return candidate;
            }
        }
        return null;
    }
}
