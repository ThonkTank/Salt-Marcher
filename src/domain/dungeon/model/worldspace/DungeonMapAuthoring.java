package src.domain.dungeon.model.worldspace;

import org.jspecify.annotations.Nullable;

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
                SpaceCatalog.empty(),
                RoomCatalog.empty(),
                ConnectionCatalog.empty(),
                FeatureCatalog.empty(),
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
                SpaceCatalog.empty(),
                rooms,
                connections,
                FeatureCatalog.empty(),
                revision);
    }

    public static DungeonMap rename(DungeonMap dungeonMap, String mapName) {
        return new DungeonMap(
                new DungeonMapMetadata(dungeonMap.metadata().mapId(), mapName),
                dungeonMap.topology(),
                dungeonMap.topologyIndex(),
                dungeonMap.spaces(),
                dungeonMap.rooms(),
                dungeonMap.connections(),
                dungeonMap.features(),
                dungeonMap.revision() + 1L);
    }
}
