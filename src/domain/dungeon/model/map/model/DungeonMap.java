package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonRoom;
import src.domain.dungeon.model.map.model.DungeonCorridorMutationLogic;
import src.domain.dungeon.model.map.model.DungeonEditorHandleMovementLogic;
import src.domain.dungeon.model.map.model.DungeonRoomTopologyEditor;
import src.domain.dungeon.model.map.model.DungeonTopologyMovementLogic;
import src.domain.dungeon.model.map.model.ConnectionCatalog;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonMapMetadata;
import src.domain.dungeon.model.map.model.DungeonMapTopology;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.model.FeatureCatalog;
import src.domain.dungeon.model.map.model.RoomCatalog;
import src.domain.dungeon.model.map.model.SpaceCatalog;
import src.domain.dungeon.model.map.model.SpatialTopology;

/**
 * Canonical aggregate root for one authored dungeon map.
 */
public final class DungeonMap {

    private static final DungeonRoomTopologyEditor ROOM_TOPOLOGY_EDITOR = new DungeonRoomTopologyEditor();
    private static final DungeonCorridorMutationLogic CORRIDOR_MUTATION_SERVICE = new DungeonCorridorMutationLogic();
    private static final DungeonTopologyMovementLogic TOPOLOGY_MOVEMENT_SERVICE = new DungeonTopologyMovementLogic();
    private static final DungeonEditorHandleMovementLogic HANDLE_MOVEMENT_SERVICE = new DungeonEditorHandleMovementLogic();

    private final DungeonMapMetadata metadata;
    private final SpatialTopology topology;
    private final DungeonMapTopology topologyIndex;
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
        this(metadata, topology, null, spaces, rooms, connections, features, revision);
    }

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
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
        this.topologyIndex = DungeonMapTopology.merge(
                topologyIndex,
                DungeonMapTopology.from(this.topology, this.rooms, this.connections));
        this.revision = Math.max(0L, revision);
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
            RoomCatalog rooms,
            ConnectionCatalog connections,
            long revision
    ) {
        return authored(mapId, mapName, topology, null, rooms, connections, revision);
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
        return TOPOLOGY_MOVEMENT_SERVICE.moveRoomAnchor(this, deltaQ, deltaR);
    }

    public DungeonMap moveTopologyElement(DungeonTopologyRef ref, int deltaQ, int deltaR) {
        return moveTopologyElement(ref, deltaQ, deltaR, 0);
    }

    public DungeonMap moveTopologyElement(DungeonTopologyRef ref, int deltaQ, int deltaR, int deltaLevel) {
        return TOPOLOGY_MOVEMENT_SERVICE.moveTopologyElement(this, ref, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMap moveEditorHandle(DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        return HANDLE_MOVEMENT_SERVICE.moveEditorHandle(this, handle, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMap moveBoundaryStretch(
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return ROOM_TOPOLOGY_EDITOR.moveBoundaryStretch(this, clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMapTopology topologyIndex() {
        return topologyIndex;
    }

    public DungeonMap saveRoomNarration(long roomId, DungeonRoomNarration narration) {
        if (roomId <= 0L || narration == null) {
            return this;
        }
        List<DungeonRoom> nextRooms = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoom room : rooms.rooms()) {
            if (room.roomId() == roomId) {
                nextRooms.add(room.withNarration(narration));
                changed = true;
            } else {
                nextRooms.add(room);
            }
        }
        return changed
                ? new DungeonMap(
                        metadata,
                        topology,
                        topologyIndex,
                        spaces,
                        new RoomCatalog(nextRooms),
                        connections,
                        features,
                        revision + 1L)
                : this;
    }

    public DungeonMap paintRoomRectangle(DungeonCell start, DungeonCell end) {
        return ROOM_TOPOLOGY_EDITOR.paintRectangle(this, start, end);
    }

    public DungeonMap deleteRoomRectangle(DungeonCell start, DungeonCell end) {
        return ROOM_TOPOLOGY_EDITOR.deleteRectangle(this, start, end);
    }

    public DungeonMap editClusterBoundaries(
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        return ROOM_TOPOLOGY_EDITOR.editBoundaries(this, clusterId, edges, kind, deleteBoundary);
    }

    public DungeonMap createCorridor(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        return CORRIDOR_MUTATION_SERVICE.createCorridor(this, start, end);
    }

    public DungeonMap extendCorridor(long corridorId, DungeonCorridorRoomEndpoint endpoint) {
        return CORRIDOR_MUTATION_SERVICE.extendCorridor(this, corridorId, endpoint);
    }

    public DungeonMap mergeCorridors(long corridorId, long mergedCorridorId) {
        return CORRIDOR_MUTATION_SERVICE.mergeCorridors(this, corridorId, mergedCorridorId);
    }

    public DungeonMap deleteCorridor(long corridorId) {
        return CORRIDOR_MUTATION_SERVICE.deleteCorridor(this, corridorId);
    }

    public DungeonMap rename(String mapName) {
        return new DungeonMap(
                new DungeonMapMetadata(metadata.mapId(), mapName),
                topology,
                topologyIndex,
                spaces,
                rooms,
                connections,
                features,
                revision + 1L);
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
