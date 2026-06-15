package src.domain.dungeon.model.core.structure;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

/**
 * Canonical aggregate root state for one authored dungeon map.
 */
public record DungeonMap(
        DungeonMapMetadata metadata,
        SpatialTopology topology,
        DungeonMapTopology topologyIndex,
        RoomCatalog rooms,
        List<Corridor> corridors,
        StairCollection stairs,
        TransitionCatalog transitionCatalog,
        long revision
) {
    private static final long NO_TRANSITION_ID = 0L;
    private static final long NO_ROOM_ID = 0L;
    private static final long NO_CLUSTER_ID = 0L;

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            StairCollection stairs,
            TransitionCatalog transitionCatalog,
            long revision
    ) {
        this(metadata, topology, null, rooms, corridors, stairs, transitionCatalog, revision);
    }

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            RoomCatalog rooms,
            List<Corridor> corridors,
            StairCollection stairs,
            TransitionCatalog transitionCatalog,
            long revision
    ) {
        this.metadata = metadata;
        this.topology = topology == null ? SpatialTopology.empty() : topology;
        this.rooms = rooms == null ? RoomCatalog.empty() : rooms;
        this.corridors = corridors == null ? List.of() : List.copyOf(corridors);
        this.stairs = stairs == null ? new StairCollection(List.of()) : stairs;
        this.transitionCatalog = transitionCatalog == null ? new TransitionCatalog(List.of()) : transitionCatalog;
        this.topologyIndex = DungeonMapTopology.merge(
                topologyIndex,
                DungeonMapTopology.from(
                        this.topology,
                        this.rooms,
                        this.corridors,
                        this.stairs.stairs(),
                        this.transitionCatalog.transitions()));
        this.revision = Math.max(0L, revision);
    }

    private static final DungeonMapRoomAuthoring ROOM_AUTHORING = new DungeonMapRoomAuthoring();
    private static final DungeonMapCorridorAuthoring CORRIDOR_AUTHORING = new DungeonMapCorridorAuthoring();
    private static final DungeonMapStairAuthoring STAIR_AUTHORING = new DungeonMapStairAuthoring();

    public DungeonMap moveCluster(long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        return ROOM_AUTHORING.moveCluster(this, clusterId, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMap moveClusterCorner(long clusterId, Cell corner, int deltaQ, int deltaR, int deltaLevel) {
        return ROOM_AUTHORING.moveClusterCorner(this, clusterId, corner, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMap moveDoorBinding(
            long corridorId,
            int bindingIndex,
            long roomId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return CORRIDOR_AUTHORING.moveDoorBinding(
                this,
                corridorId,
                bindingIndex,
                roomId,
                deltaQ,
                deltaR,
                deltaLevel);
    }

    public DungeonMap moveCorridorAnchor(
            long corridorId,
            int bindingIndex,
            DungeonTopologyRef topologyRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return CORRIDOR_AUTHORING.moveCorridorAnchor(
                this,
                corridorId,
                bindingIndex,
                topologyRef,
                deltaQ,
                deltaR,
                deltaLevel);
    }

    public DungeonMap moveCorridorWaypoint(
            long corridorId,
            int waypointIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return CORRIDOR_AUTHORING.moveCorridorWaypoint(this, corridorId, waypointIndex, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMap moveStairAnchor(long stairId, int handleIndex, int deltaQ, int deltaR, int deltaLevel) {
        return STAIR_AUTHORING.moveStairAnchor(this, stairId, handleIndex, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMap moveBoundaryStretch(
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return ROOM_AUTHORING.moveBoundaryStretch(this, clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
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
                        corridors,
                        stairs,
                        transitionCatalog,
                        revision + 1L)
                : this;
    }

    public DungeonMap saveRoomName(long roomId, String name) {
        if (roomId <= NO_ROOM_ID) {
            return this;
        }
        List<DungeonRoom> nextRooms = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoom room : rooms.rooms()) {
            if (room.roomId() == roomId) {
                DungeonRoom renamed = room.withName(name);
                nextRooms.add(renamed);
                changed = changed || !renamed.equals(room);
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
                        corridors,
                        stairs,
                        transitionCatalog,
                        revision + 1L)
                : this;
    }

    public DungeonMap saveClusterName(long clusterId, String name) {
        if (clusterId <= NO_CLUSTER_ID) {
            return this;
        }
        SpatialTopology renamedTopology = topology.withRoomClusterName(clusterId, name);
        return !renamedTopology.equals(topology)
                ? new DungeonMap(
                        metadata,
                        renamedTopology,
                        topologyIndex,
                        rooms,
                        corridors,
                        stairs,
                        transitionCatalog,
                        revision + 1L)
                : this;
    }

    public DungeonMap saveTransitionDescription(long transitionId, String description) {
        if (transitionId <= NO_TRANSITION_ID) {
            return this;
        }
        TransitionCatalog nextTransitions = transitionCatalog.withDescription(transitionId, description);
        return nextTransitions.equals(transitionCatalog)
                ? this
                : withTransitionCatalog(nextTransitions, topologyIndex);
    }

    public boolean canDeleteTransition(long transitionId) {
        return transitionCatalog.canDelete(transitionId);
    }

    public DungeonMap deleteTransition(long transitionId) {
        if (!canDeleteTransition(transitionId)) {
            return this;
        }
        return withTransitionCatalog(transitionCatalog.withoutTransition(transitionId), null);
    }

    public boolean canDeleteStair(long stairId) {
        return stairId > 0L && stairs.canDeleteUnboundStair(stairId);
    }

    public DungeonMap deleteStair(long stairId) {
        if (!canDeleteStair(stairId)) {
            return this;
        }
        return withStairs(stairs.withoutUnboundStair(stairId));
    }

    public DungeonMap createStair(long stairId, Cell anchor, String shapeName) {
        return STAIR_AUTHORING.createStair(this, stairId, anchor, shapeName);
    }

    public boolean canCreateStair(Cell anchor, String shapeName) {
        return STAIR_AUTHORING.canCreateStair(this, anchor, shapeName);
    }

    public boolean canSaveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        return STAIR_AUTHORING.canSaveStairGeometry(this, stairId, shapeName, directionName, dimension1, dimension2);
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
        return STAIR_AUTHORING.saveStairGeometry(this, stairId, shapeName, directionName, dimension1, dimension2);
    }

    public DungeonMap paintRoomRectangle(Cell start, Cell end) {
        return ROOM_AUTHORING.paintRoomRectangle(this, start, end);
    }

    public DungeonMap deleteRoomRectangle(Cell start, Cell end) {
        return ROOM_AUTHORING.deleteRoomRectangle(this, start, end);
    }

    public DungeonMap editClusterBoundaries(
            long clusterId,
            List<Edge> edges,
            BoundaryKind kind,
            boolean deleteBoundary
    ) {
        return ROOM_AUTHORING.editClusterBoundaries(this, clusterId, edges, kind, deleteBoundary);
    }

    public DungeonMap createCorridor(
            long stairId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return CORRIDOR_AUTHORING.createCorridor(this, stairId, start, end);
    }

    public DungeonMap deleteCorridor(
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        return CORRIDOR_AUTHORING.deleteCorridor(
                this,
                corridorId,
                targetKind,
                topologyRefId,
                roomId,
                waypointIndex);
    }

    DungeonMap withStairs(StairCollection nextStairs) {
        return new DungeonMap(
                metadata,
                topology,
                null,
                rooms,
                corridors,
                nextStairs,
                transitionCatalog,
                revision + 1L);
    }

    public DungeonMap withTransitionCatalog(TransitionCatalog nextTransitions) {
        return withTransitionCatalog(nextTransitions, null);
    }

    public DungeonMap withTransitionCatalog(
            TransitionCatalog nextTransitions,
            @Nullable DungeonMapTopology nextTopologyIndex
    ) {
        TransitionCatalog resolvedTransitions = nextTransitions == null
                ? new TransitionCatalog(List.of())
                : nextTransitions;
        if (resolvedTransitions.equals(transitionCatalog)) {
            return nextTopologyIndex == null || nextTopologyIndex.equals(topologyIndex)
                    ? this
                    : new DungeonMap(
                            metadata,
                            topology,
                            nextTopologyIndex,
                            rooms,
                            corridors,
                            stairs,
                            resolvedTransitions,
                            revision);
        }
        return new DungeonMap(
                metadata,
                topology,
                nextTopologyIndex,
                rooms,
                corridors,
                stairs,
                resolvedTransitions,
                revision + 1L);
    }

}
