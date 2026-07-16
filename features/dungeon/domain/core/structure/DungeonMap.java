package features.dungeon.domain.core.structure;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import features.dungeon.domain.core.structure.feature.FeatureMarkerCatalog;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.topology.DungeonMapTopology;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;

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
        FeatureMarkerCatalog featureMarkers,
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
        this(metadata, topology, null, rooms, corridors, stairs, transitionCatalog, FeatureMarkerCatalog.empty(), revision);
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
        this(metadata, topology, topologyIndex, rooms, corridors, stairs, transitionCatalog,
                FeatureMarkerCatalog.empty(), revision);
    }

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            RoomCatalog rooms,
            List<Corridor> corridors,
            StairCollection stairs,
            TransitionCatalog transitionCatalog,
            FeatureMarkerCatalog featureMarkers,
            long revision
    ) {
        this.metadata = metadata;
        this.topology = topology == null ? SpatialTopology.empty() : topology;
        this.rooms = rooms == null ? RoomCatalog.empty() : rooms;
        this.corridors = corridors == null ? List.of() : List.copyOf(corridors);
        this.stairs = stairs == null ? new StairCollection(List.of()) : stairs;
        this.transitionCatalog = transitionCatalog == null ? new TransitionCatalog(List.of()) : transitionCatalog;
        this.featureMarkers = featureMarkers == null ? FeatureMarkerCatalog.empty() : featureMarkers;
        this.topologyIndex = DungeonMapTopology.merge(
                topologyIndex,
                DungeonMapTopology.from(
                        this.topology,
                        this.rooms,
                        this.corridors,
                        this.stairs.stairs(),
                        this.transitionCatalog.transitions(),
                        this.featureMarkers.topologyBindings()));
        this.revision = Math.max(0L, revision);
    }

    private static final DungeonMapRoomAuthoring ROOM_AUTHORING = new DungeonMapRoomAuthoring();
    private static final DungeonMapConnectionAuthoring CONNECTION_AUTHORING = new DungeonMapConnectionAuthoring();
    private static final DungeonMapStairAuthoring STAIR_AUTHORING = new DungeonMapStairAuthoring();

    public long clusterIdForTopologyRef(DungeonTopologyRef topologyRef) {
        return topologyIndex.clusterIdOrZero(topologyRef);
    }

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
        return CONNECTION_AUTHORING.moveDoorBinding(
                this,
                corridorId,
                bindingIndex,
                roomId,
                deltaQ,
                deltaR,
                deltaLevel);
    }

    public DungeonMap moveDoorBoundary(
            DungeonTopologyRef topologyRef,
            long clusterId,
            long roomId,
            Edge sourceEdge,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return CONNECTION_AUTHORING.moveDoorBoundary(
                this,
                topologyRef,
                clusterId,
                roomId,
                sourceEdge,
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
        return CONNECTION_AUTHORING.moveCorridorAnchor(
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
        return CONNECTION_AUTHORING.moveCorridorWaypoint(this, corridorId, waypointIndex, deltaQ, deltaR, deltaLevel);
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
        var nextRooms = new ArrayList<>(rooms.rooms());
        boolean changed = false;
        for (int index = 0; index < nextRooms.size(); index++) {
            var room = nextRooms.get(index);
            if (room.roomId() == roomId) {
                nextRooms.set(index, room.withNarration(narration));
                changed = true;
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
                        featureMarkers,
                        revision + 1L)
                : this;
    }

    public DungeonMap saveRoomName(long roomId, String name) {
        if (roomId <= NO_ROOM_ID) {
            return this;
        }
        var nextRooms = new ArrayList<>(rooms.rooms());
        boolean changed = false;
        for (int index = 0; index < nextRooms.size(); index++) {
            var room = nextRooms.get(index);
            if (room.roomId() == roomId) {
                var renamed = room.withName(name);
                nextRooms.set(index, renamed);
                changed = changed || !renamed.equals(room);
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
                        featureMarkers,
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
                        featureMarkers,
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

    public long nextFeatureMarkerId() {
        return featureMarkers.nextMarkerId();
    }

    public boolean canDeleteFeatureMarker(long markerId) {
        return featureMarkers.canDelete(markerId);
    }

    public DungeonMap deleteFeatureMarker(long markerId) {
        if (!canDeleteFeatureMarker(markerId)) {
            return this;
        }
        return withFeatureMarkers(featureMarkers.withoutMarker(markerId));
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

    public DungeonMap createStair(
            long stairId,
            StairGeometrySpec spec
    ) {
        return STAIR_AUTHORING.createStair(this, stairId, spec);
    }

    public boolean canCreateStair(StairGeometrySpec spec) {
        return STAIR_AUTHORING.canCreateStair(this, spec);
    }

    public boolean canSaveStairGeometry(
            long stairId,
            StairGeometrySpec spec
    ) {
        return STAIR_AUTHORING.canSaveStairGeometry(this, stairId, spec);
    }

    public DungeonMap saveStairGeometry(
            long stairId,
            StairGeometrySpec spec
    ) {
        if (!canSaveStairGeometry(stairId, spec)) {
            return this;
        }
        return STAIR_AUTHORING.saveStairGeometry(this, stairId, spec);
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
        return CONNECTION_AUTHORING.createCorridor(this, stairId, start, end);
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
                featureMarkers,
                revision + 1L);
    }

    public DungeonMap withFeatureMarkers(FeatureMarkerCatalog nextFeatureMarkers) {
        FeatureMarkerCatalog resolvedFeatureMarkers = nextFeatureMarkers == null
                ? FeatureMarkerCatalog.empty()
                : nextFeatureMarkers;
        if (resolvedFeatureMarkers.equals(featureMarkers)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                topology,
                null,
                rooms,
                corridors,
                stairs,
                transitionCatalog,
                resolvedFeatureMarkers,
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
                            featureMarkers,
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
                featureMarkers,
                revision + 1L);
    }

}
