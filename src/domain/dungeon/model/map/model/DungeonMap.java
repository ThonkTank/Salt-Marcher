package src.domain.dungeon.model.map.model;

import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;

/**
 * Canonical aggregate root state for one authored dungeon map.
 */
public record DungeonMap(
        DungeonMapMetadata metadata,
        SpatialTopology topology,
        DungeonMapTopology topologyIndex,
        SpaceCatalog spaces,
        RoomCatalog rooms,
        ConnectionCatalog connections,
        FeatureCatalog features,
        long revision
) {

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

    private static final DungeonRoomTopologyEditor ROOM_TOPOLOGY_EDITOR = new DungeonRoomTopologyEditor();
    private static final DungeonTopologyMovementLogic TOPOLOGY_MOVEMENT_SERVICE = new DungeonTopologyMovementLogic();
    private static final DungeonEditorHandleMovementLogic HANDLE_MOVEMENT_SERVICE = new DungeonEditorHandleMovementLogic();
    private static final DungeonCorridorMutationLogic CORRIDOR_MUTATION_SERVICE = new DungeonCorridorMutationLogic();

    public DungeonMap moveRoomAnchor(int deltaQ, int deltaR) {
        return TOPOLOGY_MOVEMENT_SERVICE.moveRoomAnchor(this, deltaQ, deltaR);
    }

    public DungeonMap moveTopologyElement(
            DungeonTopologyRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return TOPOLOGY_MOVEMENT_SERVICE.moveTopologyElement(this, ref, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMap moveEditorHandle(
            DungeonEditorHandle handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
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

    public DungeonMap createCorridor(
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return CORRIDOR_MUTATION_SERVICE.createCorridor(this, start, end);
    }

    public DungeonMap mergeCorridors(long corridorId, long mergedCorridorId) {
        return CORRIDOR_MUTATION_SERVICE.mergeCorridors(this, corridorId, mergedCorridorId);
    }

    public DungeonMap deleteCorridor(long corridorId) {
        return CORRIDOR_MUTATION_SERVICE.deleteCorridor(this, corridorId);
    }
}
