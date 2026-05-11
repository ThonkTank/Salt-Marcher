package src.domain.dungeon.model.map.model;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonCorridor;
import src.domain.dungeon.model.map.model.DungeonRoom;
import src.domain.dungeon.model.map.model.DungeonRoomCluster;

public final class DungeonMapLookupLogic {

    public @Nullable DungeonRoom room(DungeonMap dungeonMap, long roomId) {
        return dungeonMap.rooms().rooms().stream()
                .filter(room -> room.roomId() == roomId)
                .findFirst()
                .orElse(null);
    }

    public @Nullable DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        return dungeonMap.topology().roomClusters().stream()
                .filter(cluster -> cluster.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    public @Nullable DungeonCorridor corridor(DungeonMap dungeonMap, long corridorId) {
        return dungeonMap.connections().corridors().stream()
                .filter(candidate -> candidate.corridorId() == corridorId)
                .findFirst()
                .orElse(null);
    }
}
