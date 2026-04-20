package src.domain.dungeon.map;

import src.domain.dungeon.published.DungeonMapId;

/**
 * Canonical aggregate root for one authored dungeon map.
 */
public record DungeonMap(
        DungeonMapMetadata metadata,
        SpatialTopology topology,
        SpaceCatalog spaces,
        RoomCatalog rooms,
        ConnectionCatalog connections,
        FeatureCatalog features,
        long revision
) {

    public DungeonMap {
        topology = topology == null ? SpatialTopology.empty() : topology;
        spaces = spaces == null ? SpaceCatalog.empty() : spaces;
        rooms = rooms == null ? RoomCatalog.empty() : rooms;
        connections = connections == null ? ConnectionCatalog.empty() : connections;
        features = features == null ? FeatureCatalog.empty() : features;
        revision = Math.max(0L, revision);
    }

    public static DungeonMap empty(DungeonMapId mapId, String mapName) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                SpatialTopology.empty(),
                SpaceCatalog.empty(),
                RoomCatalog.empty(),
                ConnectionCatalog.empty(),
                FeatureCatalog.empty(),
                1L);
    }
}
