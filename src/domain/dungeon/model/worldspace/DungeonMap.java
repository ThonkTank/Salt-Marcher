package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMapMetadata;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;

/**
 * Canonical aggregate root state for one authored dungeon map.
 */
public record DungeonMap(
        DungeonMapMetadata metadata,
        SpatialTopology topology,
        DungeonMapTopology topologyIndex,
        RoomCatalog rooms,
        ConnectionCatalog connections,
        long revision
) {
    private static final long NO_TRANSITION_ID = 0L;
    private static final long NO_STAIR_ID = 0L;

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            long revision
    ) {
        this(metadata, topology, null, rooms, connections, revision);
    }

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            long revision
    ) {
        this.metadata = metadata;
        this.topology = topology == null ? SpatialTopology.empty() : topology;
        this.rooms = rooms == null ? RoomCatalog.empty() : rooms;
        this.connections = connections == null ? ConnectionCatalog.empty() : connections;
        this.topologyIndex = DungeonMapTopology.merge(
                topologyIndex,
                DungeonMapTopology.from(this.topology, this.rooms, this.connections));
        this.revision = Math.max(0L, revision);
    }

    private static final DungeonRoomTopologyEditor ROOM_TOPOLOGY_EDITOR = new DungeonRoomTopologyEditor();
    private static final DungeonEditorHandleMovementLogic HANDLE_MOVEMENT_SERVICE = new DungeonEditorHandleMovementLogic();
    private static final DungeonCorridorMutationLogic CORRIDOR_MUTATION_SERVICE = new DungeonCorridorMutationLogic();

    public DungeonMap moveEditorHandle(
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return HANDLE_MOVEMENT_SERVICE.moveEditorHandle(this, handle, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMap moveBoundaryStretch(
            long clusterId,
            List<Edge> sourceEdges,
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
                        new RoomCatalog(nextRooms),
                        connections,
                        revision + 1L)
                : this;
    }

    public DungeonMap saveTransitionDescription(long transitionId, String description) {
        if (transitionId <= NO_TRANSITION_ID) {
            return this;
        }
        ConnectionCatalog nextConnections = connections.withTransitions(
                DungeonTransition.withDescription(connections.transitionCatalog(), transitionId, description));
        return nextConnections.equals(connections)
                ? this
                : new DungeonMap(
                        metadata,
                        topology,
                        topologyIndex,
                        rooms,
                        nextConnections,
                        revision + 1L);
    }

    public boolean canDeleteTransition(long transitionId) {
        return DungeonTransition.canDelete(connections.transitionCatalog(), transitionId);
    }

    public @Nullable DungeonTransition transitionById(long transitionId) {
        for (DungeonTransition transition : connections.transitions()) {
            if (transition.transitionId() == transitionId) {
                return transition;
            }
        }
        return null;
    }

    public DungeonMap withMapLocalAuthoredTransitionLink(AuthoredTransitionLink link) {
        return withTransitionCatalogRevision(
                DungeonTransition.withMapLocalAuthoredTransitionLink(connections.transitionCatalog(), link));
    }

    public DungeonMap deleteTransition(long transitionId) {
        if (!canDeleteTransition(transitionId)) {
            return this;
        }
        ConnectionCatalog nextConnections = connections.withTransitions(
                DungeonTransition.withoutTransition(connections.transitionCatalog(), transitionId));
        return new DungeonMap(
                metadata,
                topology,
                null,
                rooms,
                nextConnections,
                revision + 1L);
    }

    public boolean canDeleteStair(long stairId) {
        return stairId > NO_STAIR_ID && DungeonStair.canDeleteUnbound(connections.stairCollection(), stairId);
    }

    public DungeonMap deleteStair(long stairId) {
        if (!canDeleteStair(stairId)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                rooms,
                connections.withStairs(DungeonStair.withoutUnbound(connections.stairCollection(), stairId)),
                revision + 1L);
    }

    public DungeonMap createStair(long stairId, Cell anchor, String shapeName) {
        ConnectionCatalog nextConnections = connections.withStairs(DungeonStair.withCreated(
                connections.stairCollection(),
                stairId,
                metadata.mapId().value(),
                anchor,
                shapeName,
                topology,
                rooms));
        if (nextConnections.equals(connections)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                rooms,
                nextConnections,
                revision + 1L);
    }

    public boolean canCreateStair(Cell anchor, String shapeName) {
        return DungeonStair.canCreate(connections.stairCollection(), anchor, shapeName, topology, rooms);
    }

    public DungeonMap createTransition(
            long transitionId,
            Cell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        ConnectionCatalog nextConnections = connections.withTransitions(DungeonTransition.withCreated(
                connections.transitionCatalog(),
                transitionId,
                metadata.mapId().value(),
                anchor,
                dungeonMapDestination,
                destinationMapId,
                destinationTileId,
                destinationTransitionId));
        if (nextConnections.equals(connections)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                rooms,
                nextConnections,
                revision + 1L);
    }

    public boolean canCreateTransition(
            Cell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        return DungeonTransition.canCreate(
                connections.transitionCatalog(),
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
        return DungeonStair.canRecompute(
                connections.stairCollection(),
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
        ConnectionCatalog nextConnections = connections.withStairs(DungeonStair.withRecomputed(
                connections.stairCollection(),
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2,
                topology,
                rooms));
        if (nextConnections.equals(connections)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                rooms,
                nextConnections,
                revision + 1L);
    }

    private DungeonMap withTransitionCatalogRevision(TransitionCatalog nextTransitions) {
        ConnectionCatalog nextConnections = connections.withTransitions(nextTransitions);
        if (nextConnections.equals(connections)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                rooms,
                nextConnections,
                revision + 1L);
    }

    public DungeonMap paintRoomRectangle(Cell start, Cell end) {
        return ROOM_TOPOLOGY_EDITOR.paintRectangle(this, start, end);
    }

    public DungeonMap deleteRoomRectangle(Cell start, Cell end) {
        return ROOM_TOPOLOGY_EDITOR.deleteRectangle(this, start, end);
    }

    public DungeonMap editClusterBoundaries(
            long clusterId,
            List<Edge> edges,
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
