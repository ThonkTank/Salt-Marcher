package src.domain.dungeon.model.worldspace;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.DungeonMapMetadata;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;

public final class DungeonMapAuthoring {

    private DungeonMapAuthoring() {
    }

    public static DungeonMap empty(DungeonMapIdentity mapId, String mapName) {
        return authored(mapId, mapName, SpatialTopology.empty(), 1L);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            long revision
    ) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                topology,
                RoomCatalog.empty(),
                ConnectionCatalog.empty(),
                revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            long revision
    ) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                topology,
                topologyIndex,
                rooms,
                connections,
                revision);
    }

    public static DungeonMap rename(DungeonMap dungeonMap, String mapName) {
        return new DungeonMap(
                new DungeonMapMetadata(dungeonMap.metadata().mapId(), mapName),
                dungeonMap.topology(),
                dungeonMap.topologyIndex(),
                dungeonMap.rooms(),
                dungeonMap.connections(),
                dungeonMap.revision() + 1L);
    }
}
