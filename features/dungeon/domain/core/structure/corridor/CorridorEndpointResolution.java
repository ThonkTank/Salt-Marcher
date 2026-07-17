package features.dungeon.domain.core.structure.corridor;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMutation;
import features.dungeon.domain.core.structure.room.RoomTopologyRebuilder.RebuildResult;
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
            CorridorHostCells hostCells
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (endpoint == null || !endpoint.present()) {
            return null;
        }
        if (endpoint.isDoorEndpoint()) {
            return resolveDoorEndpoint(dungeonMap, endpoint);
        }
        if (endpoint.isAnchorEndpoint()) {
            return resolveAnchorEndpoint(dungeonMap, endpoint, hostCells);
        }
        return null;
    }

    private static @Nullable ResolvedEndpointResult resolveDoorEndpoint(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint
    ) {
        if (CorridorMapLookup.cluster(dungeonMap, endpoint.clusterId()) == null) {
            return null;
        }
        Edge edge = Edge.sideOf(endpoint.roomCell(), endpoint.direction());
        DungeonMap mapped = ensureDoorBoundary(dungeonMap, endpoint.clusterId(), edge);
        RoomCluster mappedCluster = CorridorMapLookup.cluster(mapped, endpoint.clusterId());
        DungeonClusterBoundary boundary = boundaryAt(mapped, endpoint.clusterId(), edge);
        if (mappedCluster == null || boundary == null || !boundary.isDoor()) {
            return null;
        }
        CorridorDoorBindingState binding = new CorridorDoorBindingState(
                endpoint.roomId(),
                endpoint.clusterId(),
                new Cell(
                        endpoint.roomCell().q() - mappedCluster.center().q(),
                        endpoint.roomCell().r() - mappedCluster.center().r(),
                        endpoint.roomCell().level()),
                endpoint.direction(),
                boundary.resolvedTopologyRef(mappedCluster.center()));
        return new ResolvedEndpointResult(
                mapped,
                CorridorResolvedEndpoint.forDoor(binding.toCore(), CorridorEndpointMatching.doorSemantics(binding)),
                binding);
    }

    private static @Nullable ResolvedEndpointResult resolveAnchorEndpoint(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint,
            CorridorHostCells hostCells
    ) {
        CorridorAnchorEndpointMaterialization.AuthoredEndpointMaterialization resolved =
                CorridorAnchorEndpointMaterialization.materializeAuthored(
                        dungeonMap.corridors(),
                        endpoint,
                        localAnchorId(dungeonMap, endpoint),
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
        return new ResolvedEndpointResult(resolvedMap, resolvedAnchor(resolved.anchor()), null);
    }

    private static DungeonMap ensureDoorBoundary(DungeonMap dungeonMap, long clusterId, Edge edge) {
        DungeonClusterBoundary existing = boundaryAt(dungeonMap, clusterId, edge);
        if (existing != null && existing.isDoor()) {
            return dungeonMap;
        }
        return BOUNDARY_MUTATION.editBoundaries(
                        dungeonMap.topology(),
                        dungeonMap.rooms(),
                        dungeonMap.corridors(),
                        clusterId,
                        List.of(edge),
                        BoundaryKind.DOOR,
                        false)
                .map(result -> withRoomTopology(dungeonMap, result))
                .orElse(dungeonMap);
    }

    private static DungeonMap withRoomTopology(DungeonMap dungeonMap, RebuildResult rebuild) {
        return new DungeonMap(
                dungeonMap.metadata(),
                rebuild.topology(),
                rebuild.rooms(),
                dungeonMap.corridors(),
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog(),
                dungeonMap.revision() + 1L);
    }

    private static @Nullable DungeonClusterBoundary boundaryAt(DungeonMap dungeonMap, long clusterId, Edge edge) {
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
            CorridorResolvedEndpoint endpoint,
            @Nullable CorridorDoorBindingState replacementDoor
    ) {
        Corridor applyTo(Corridor corridor) {
            return corridor.withResolvedEndpoint(endpoint, replacementDoor);
        }
    }
}
