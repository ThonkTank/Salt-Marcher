package features.dungeon.domain.core.structure.corridor;

import features.dungeon.domain.core.component.CorridorDoorBinding;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMutation;
import features.dungeon.domain.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog;
import features.dungeon.domain.core.structure.topology.DungeonMapTopology.DungeonTopologyBinding;

/**
 * Owns authored corridor endpoint resolution and materialization.
 */
final class CorridorEndpointResolution {
    private static final RoomClusterBoundaryMutation BOUNDARY_MUTATION =
            new RoomClusterBoundaryMutation();

    @Nullable
    ResolvedEndpointResult resolve(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint,
            CorridorHostCells hostCells,
            long reservedAnchorId,
            RoomTopologyWorkCatalog.ReservedIdentities roomIds
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        Objects.requireNonNull(roomIds, "roomIds");
        if (reservedAnchorId <= 0L) {
            throw new IllegalArgumentException("corridor-anchor identity must be positive");
        }
        if (endpoint == null || !endpoint.present()) {
            return null;
        }
        if (endpoint.isDoorEndpoint()) {
            return resolveDoorEndpoint(dungeonMap, endpoint, roomIds);
        }
        if (endpoint.isAnchorEndpoint()) {
            return resolveAnchorEndpoint(dungeonMap, endpoint, hostCells, reservedAnchorId);
        }
        return null;
    }

    private static @Nullable ResolvedEndpointResult resolveDoorEndpoint(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint,
            RoomTopologyWorkCatalog.ReservedIdentities roomIds
    ) {
        if (CorridorMapLookup.cluster(dungeonMap, endpoint.clusterId()) == null) {
            return null;
        }
        Edge edge = Edge.sideOf(endpoint.roomCell(), endpoint.direction());
        DungeonMap mapped = ensureDoorBoundary(dungeonMap, endpoint.clusterId(), edge, roomIds);
        RoomCluster mappedCluster = CorridorMapLookup.cluster(mapped, endpoint.clusterId());
        BoundarySegment boundary = boundaryAt(mapped, endpoint.clusterId(), edge);
        if (mappedCluster == null || boundary == null || !boundary.isDoor()) {
            return null;
        }
        CorridorDoorBinding binding = new CorridorDoorBinding(
                endpoint.roomId(),
                endpoint.clusterId(),
                endpoint.roomCell(),
                endpoint.direction(),
                boundary.resolvedTopologyRef());
        return new ResolvedEndpointResult(
                mapped,
                CorridorResolvedEndpoint.forDoor(binding, CorridorEndpointMatching.doorSemantics(binding)));
    }

    private static @Nullable ResolvedEndpointResult resolveAnchorEndpoint(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint,
            CorridorHostCells hostCells,
            long reservedAnchorId
    ) {
        CorridorAnchorEndpointMaterialization.AuthoredEndpointMaterialization resolved =
                CorridorAnchorEndpointMaterialization.materializeAuthored(
                        dungeonMap.corridors(),
                        endpoint,
                        localAnchorId(dungeonMap, endpoint),
                        reservedAnchorId,
                        hostCells);
        if (resolved == null) {
            return null;
        }
        DungeonMap resolvedMap = resolved.changed()
                ? new DungeonMap(
                        dungeonMap.metadata(),
                        dungeonMap.topology(),
                        dungeonMap.topologyIndex(),
                        dungeonMap.rooms(),
                        resolved.corridors(),
                        dungeonMap.stairs(),
                        dungeonMap.transitionCatalog(),
                        dungeonMap.revision() + 1L)
                : dungeonMap;
        return new ResolvedEndpointResult(resolvedMap, resolvedAnchor(resolved.anchor()));
    }

    private static DungeonMap ensureDoorBoundary(
            DungeonMap dungeonMap,
            long clusterId,
            Edge edge,
            RoomTopologyWorkCatalog.ReservedIdentities roomIds
    ) {
        BoundarySegment existing = boundaryAt(dungeonMap, clusterId, edge);
        if (existing != null && existing.isDoor()) {
            return dungeonMap;
        }
        var rebuild = BOUNDARY_MUTATION.editBoundaries(
                dungeonMap.topology(),
                dungeonMap.rooms(),
                dungeonMap.corridors(),
                clusterId,
                List.of(edge),
                BoundaryKind.DOOR,
                false,
                roomIds);
        return rebuild
                .map(result -> withRoomTopology(dungeonMap, result))
                .orElse(dungeonMap);
    }

    private static DungeonMap withRoomTopology(DungeonMap dungeonMap, RebuildResult rebuild) {
        return new DungeonMap(
                dungeonMap.metadata(),
                rebuild.topology(),
                dungeonMap.topologyIndex(),
                rebuild.rooms(),
                dungeonMap.corridors(),
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog(),
                dungeonMap.featureMarkers(),
                dungeonMap.revision() + 1L);
    }

    private static @Nullable BoundarySegment boundaryAt(DungeonMap dungeonMap, long clusterId, Edge edge) {
        RoomCluster cluster = CorridorMapLookup.cluster(dungeonMap, clusterId);
        if (cluster == null || edge == null) {
            return null;
        }
        return cluster.boundaryAt(edge);
    }

    private static CorridorResolvedEndpoint resolvedAnchor(CorridorAnchor anchor) {
        CorridorAnchorRef ref = new CorridorAnchorRef(anchor.hostCorridorId(), anchor.anchorId());
        return CorridorResolvedEndpoint.forAnchor(ref);
    }

    private static long localAnchorId(DungeonMap dungeonMap, DungeonCorridorEndpoint endpoint) {
        DungeonTopologyBinding binding = dungeonMap.topologyIndex().binding(endpoint.topologyRef());
        if (binding != null
                && binding.corridorId() == endpoint.hostCorridorId()
                && binding.localElementId() > 0L) {
            return binding.localElementId();
        }
        return 0L;
    }

    record ResolvedEndpointResult(
            DungeonMap map,
            CorridorResolvedEndpoint endpoint
    ) {
        Corridor applyTo(Corridor corridor) {
            return corridor.withResolvedEndpoint(endpoint);
        }
    }
}
