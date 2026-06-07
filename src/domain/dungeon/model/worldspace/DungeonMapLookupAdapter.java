package src.domain.dungeon.model.worldspace;

import java.util.Optional;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

/**
 * Transitional adapter while corridor callers still read through the aggregate shell.
 *
 * <p>Delete this adapter when the productive corridor callers consume the core
 * aggregate owner directly.
 */
final class DungeonMapLookupAdapter {

    Optional<DungeonRoom> room(DungeonMap dungeonMap, long roomId) {
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room != null && room.roomId() == roomId) {
                return Optional.of(room);
            }
        }
        return Optional.empty();
    }

    Optional<DungeonRoomCluster> cluster(DungeonMap dungeonMap, long clusterId) {
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null && cluster.clusterId() == clusterId) {
                return Optional.of(cluster);
            }
        }
        return Optional.empty();
    }

    Optional<Corridor> corridor(DungeonMap dungeonMap, long corridorId) {
        for (Corridor candidate : dungeonMap.corridors()) {
            if (candidate != null && candidate.corridorId() == corridorId) {
                return Optional.of(candidate);
            }
        }
        return Optional.empty();
    }
}
