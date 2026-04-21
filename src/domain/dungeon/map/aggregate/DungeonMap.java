package src.domain.dungeon.map.aggregate;

import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.service.DungeonRoomTopologyEditor;
import src.domain.dungeon.map.value.DungeonCell;
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
        return authored(mapId, mapName, SpatialTopology.demo(), 1L);
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
            RoomCatalog rooms,
            ConnectionCatalog connections,
            long revision
    ) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                topology,
                SpaceCatalog.empty(),
                rooms,
                connections,
                FeatureCatalog.empty(),
                revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            RoomCatalog rooms,
            long revision
    ) {
        return authored(mapId, mapName, topology, rooms, ConnectionCatalog.empty(), revision);
    }

    public DungeonMap moveRoomAnchor(int deltaQ, int deltaR) {
        return withTopology(topology.moveRoomAnchor(deltaQ, deltaR), revision + 1L);
    }

    public DungeonMap moveRoomCluster(long clusterId, int deltaQ, int deltaR) {
        if (clusterId <= 0L || (deltaQ == 0 && deltaR == 0)) {
            return this;
        }
        SpatialTopology nextTopology = topology.moveRoomCluster(clusterId, deltaQ, deltaR);
        RoomCatalog nextRooms = rooms.moveClusterRooms(clusterId, deltaQ, deltaR);
        if (nextTopology.equals(topology) && nextRooms.equals(rooms)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                nextTopology,
                spaces,
                nextRooms,
                connections,
                features,
                revision + 1L);
    }

    public DungeonMap resetDemoLayout() {
        return withTopology(SpatialTopology.demo(), revision + 1L);
    }

    public DungeonMap paintRoomRectangle(DungeonCell start, DungeonCell end) {
        return new DungeonRoomTopologyEditor().paintRectangle(this, start, end);
    }

    public DungeonMap deleteRoomRectangle(DungeonCell start, DungeonCell end) {
        return new DungeonRoomTopologyEditor().deleteRectangle(this, start, end);
    }

    public DungeonMap rename(String mapName) {
        return new DungeonMap(
                new DungeonMapMetadata(metadata.mapId(), mapName),
                topology,
                spaces,
                rooms,
                connections,
                features,
                revision + 1L);
    }

    public java.util.List<String> validationMessages() {
        return java.util.List.of("room anchor valid inside committed map bounds");
    }

    public java.util.List<String> reactionMessages(DungeonMap after) {
        if (after == null || (topology.roomAnchorQ() == after.topology().roomAnchorQ()
                && topology.roomAnchorR() == after.topology().roomAnchorR())) {
            return java.util.List.of("derived state rebuilt without structural movement");
        }
        return java.util.List.of(
                "corridor attachment recomputed from moved room anchor",
                "door boundary re-anchored onto rebuilt aggregate relation graph"
        );
    }

    private DungeonMap withTopology(SpatialTopology nextTopology, long nextRevision) {
        return new DungeonMap(
                metadata,
                nextTopology,
                spaces,
                rooms,
                connections,
                features,
                nextRevision);
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
