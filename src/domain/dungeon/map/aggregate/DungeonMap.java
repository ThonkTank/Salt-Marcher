package src.domain.dungeon.map.aggregate;

import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonMapMetadata;
import src.domain.dungeon.map.value.FeatureCatalog;
import src.domain.dungeon.map.value.RoomCatalog;
import src.domain.dungeon.map.value.SpaceCatalog;
import src.domain.dungeon.map.value.SpatialTopology;

/**
 * Canonical aggregate root for one authored dungeon map.
 */
public final class DungeonMap {

    private final DungeonMapMetadata metadata;
    private final SpatialTopology topology;
    private final SpaceCatalog spaces;
    private final RoomCatalog rooms;
    private final ConnectionCatalog connections;
    private final FeatureCatalog features;
    private final long revision;

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            SpaceCatalog spaces,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            FeatureCatalog features,
            long revision
    ) {
        this.metadata = metadata;
        this.topology = topology == null ? SpatialTopology.empty() : topology;
        this.spaces = spaces == null ? SpaceCatalog.empty() : spaces;
        this.rooms = rooms == null ? RoomCatalog.empty() : rooms;
        this.connections = connections == null ? ConnectionCatalog.empty() : connections;
        this.features = features == null ? FeatureCatalog.empty() : features;
        this.revision = Math.max(0L, revision);
    }

    public static DungeonMap empty(DungeonMapIdentity mapId, String mapName) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                SpatialTopology.empty(),
                SpaceCatalog.empty(),
                RoomCatalog.empty(),
                ConnectionCatalog.empty(),
                FeatureCatalog.empty(),
                1L);
    }

    public DungeonMapMetadata metadata() {
        return metadata;
    }

    public SpatialTopology topology() {
        return topology;
    }

    public SpaceCatalog spaces() {
        return spaces;
    }

    public RoomCatalog rooms() {
        return rooms;
    }

    public ConnectionCatalog connections() {
        return connections;
    }

    public FeatureCatalog features() {
        return features;
    }

    public long revision() {
        return revision;
    }
}
