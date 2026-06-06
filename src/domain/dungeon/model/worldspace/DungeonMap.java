package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

import src.domain.dungeon.model.core.structure.topology.DungeonMapTopology;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMapMetadata;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;

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

    private static final DungeonRoomTopologyEditor ROOM_TOPOLOGY_EDITOR = new DungeonRoomTopologyEditor();
    private static final DungeonEditorHandleMovementLogic HANDLE_MOVEMENT_SERVICE = new DungeonEditorHandleMovementLogic();
    private static final DungeonCorridorCreationLogic CORRIDOR_CREATION = new DungeonCorridorCreationLogic();
    private static final DungeonCorridorMergeDeleteLogic CORRIDOR_DELETION = new DungeonCorridorMergeDeleteLogic();
    private static final StairRoomInteriorCells STAIR_ROOM_INTERIOR_CELLS = new StairRoomInteriorCells();

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
        StairCollection nextStairs = stairs.withAuthoredStair(
                stairId,
                metadata.mapId().value(),
                anchor,
                shapeName,
                STAIR_ROOM_INTERIOR_CELLS.from(topology, rooms));
        if (nextStairs.equals(stairs)) {
            return this;
        }
        return withStairs(nextStairs);
    }

    public boolean canCreateStair(Cell anchor, String shapeName) {
        return stairs.canCreateAuthoredStairGeometry(
                anchor,
                shapeName,
                STAIR_ROOM_INTERIOR_CELLS.from(topology, rooms));
    }

    public boolean canSaveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        return stairs.canRecomputeAuthoredStair(
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2,
                STAIR_ROOM_INTERIOR_CELLS.from(topology, rooms));
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
        StairCollection nextStairs = stairs.withRecomputedAuthoredStair(
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2,
                STAIR_ROOM_INTERIOR_CELLS.from(topology, rooms));
        if (nextStairs.equals(stairs)) {
            return this;
        }
        return withStairs(nextStairs);
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
            BoundaryKind kind,
            boolean deleteBoundary
    ) {
        return ROOM_TOPOLOGY_EDITOR.editBoundaries(this, clusterId, edges, kind, deleteBoundary);
    }

    public DungeonMap createCorridor(
            long stairId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return CORRIDOR_CREATION.createCorridor(this, stairId, start, end);
    }

    public DungeonMap deleteCorridor(
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        return CORRIDOR_DELETION.deleteCorridor(
                this,
                corridorId,
                targetKind,
                topologyRefId,
                roomId,
                waypointIndex);
    }

    private DungeonMap withStairs(StairCollection nextStairs) {
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
