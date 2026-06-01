package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;

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
    private static final long NO_TRANSITION_ID = 0L;
    private static final long NO_STAIR_ID = 0L;

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
    private static final DungeonEditorHandleMovementLogic HANDLE_MOVEMENT_SERVICE = new DungeonEditorHandleMovementLogic();
    private static final DungeonCorridorMutationLogic CORRIDOR_MUTATION_SERVICE = new DungeonCorridorMutationLogic();

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

    public DungeonMap saveTransitionDescription(long transitionId, String description) {
        if (transitionId <= NO_TRANSITION_ID) {
            return this;
        }
        List<DungeonTransition> nextTransitions = new ArrayList<>();
        boolean changed = false;
        for (DungeonTransition transition : connections.transitions()) {
            if (transition.transitionId() == transitionId) {
                nextTransitions.add(transition.withDescription(description));
                changed = true;
            } else {
                nextTransitions.add(transition);
            }
        }
        return changed
                ? new DungeonMap(
                        metadata,
                        topology,
                        topologyIndex,
                        spaces,
                        rooms,
                        new ConnectionCatalog(connections.corridors(), connections.stairs(), nextTransitions),
                        features,
                        revision + 1L)
                : this;
    }

    public boolean canDeleteTransition(long transitionId) {
        if (transitionId <= NO_TRANSITION_ID || protectedTransition(transitionId)) {
            return false;
        }
        for (DungeonTransition transition : connections.transitions()) {
            if (transition.transitionId() == transitionId) {
                return true;
            }
        }
        return false;
    }

    public DungeonMap deleteTransition(long transitionId) {
        if (!canDeleteTransition(transitionId)) {
            return this;
        }
        List<DungeonTransition> nextTransitions = new ArrayList<>();
        boolean changed = false;
        for (DungeonTransition transition : connections.transitions()) {
            if (transition.transitionId() == transitionId) {
                changed = true;
            } else {
                nextTransitions.add(transition);
            }
        }
        return changed
                ? new DungeonMap(
                        metadata,
                        topology,
                        null,
                        spaces,
                        rooms,
                        new ConnectionCatalog(connections.corridors(), connections.stairs(), nextTransitions),
                        features,
                        revision + 1L)
                : this;
    }

    public boolean canDeleteStair(long stairId) {
        return stairId > NO_STAIR_ID && connections.canDeleteUnboundStair(stairId);
    }

    public DungeonMap deleteStair(long stairId) {
        if (!canDeleteStair(stairId)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                spaces,
                rooms,
                connections.withoutStair(stairId),
                features,
                revision + 1L);
    }

    public DungeonMap createStair(long stairId, DungeonCell anchor, String shapeName) {
        ConnectionCatalog nextConnections = connections.withStair(
                stairId,
                metadata.mapId().value(),
                anchor,
                shapeName,
                topology,
                rooms);
        if (nextConnections.equals(connections)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                spaces,
                rooms,
                nextConnections,
                features,
                revision + 1L);
    }

    public boolean canCreateStair(DungeonCell anchor, String shapeName) {
        return connections.canCreateStair(anchor, shapeName, topology, rooms);
    }

    public DungeonMap createTransition(
            long transitionId,
            DungeonCell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        ConnectionCatalog nextConnections = connections.withTransition(
                transitionId,
                metadata.mapId().value(),
                anchor,
                dungeonMapDestination,
                destinationMapId,
                destinationTileId,
                destinationTransitionId);
        if (nextConnections.equals(connections)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                spaces,
                rooms,
                nextConnections,
                features,
                revision + 1L);
    }

    public boolean canCreateTransition(
            DungeonCell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        return connections.canCreateTransition(
                anchor,
                dungeonMapDestination,
                destinationMapId,
                destinationTileId,
                destinationTransitionId);
    }

    public boolean canSaveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        return connections.canRecomputeStair(
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2,
                topology,
                rooms);
    }

    public DungeonMap saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        if (!canSaveStairGeometry(stairId, shapeName, directionName, dimension1, dimension2)) {
            return this;
        }
        ConnectionCatalog nextConnections = connections.withRecomputedStair(
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2,
                topology,
                rooms);
        if (nextConnections.equals(connections)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                spaces,
                rooms,
                nextConnections,
                features,
                revision + 1L);
    }

    private boolean protectedTransition(long transitionId) {
        for (DungeonTransition transition : connections.transitions()) {
            if (selectedTransitionHasLink(transition, transitionId)
                    || otherTransitionReferences(transition, transitionId)) {
                return true;
            }
        }
        return false;
    }

    private static boolean selectedTransitionHasLink(DungeonTransition transition, long transitionId) {
        return transition.transitionId() == transitionId && transition.linkedTransitionId() != null;
    }

    private static boolean otherTransitionReferences(DungeonTransition transition, long transitionId) {
        return transition.transitionId() != transitionId
                && (matchesId(transition.linkedTransitionId(), transitionId)
                        || matchesId(transition.destination().transitionId(), transitionId));
    }

    private static boolean matchesId(@Nullable Long id, long transitionId) {
        return id != null && id == transitionId;
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
            long stairId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return CORRIDOR_MUTATION_SERVICE.createCorridor(this, stairId, start, end);
    }

    public DungeonMap deleteCorridor(
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        return CORRIDOR_MUTATION_SERVICE.deleteCorridor(
                this,
                corridorId,
                targetKind,
                topologyRefId,
                roomId,
                waypointIndex);
    }

}
