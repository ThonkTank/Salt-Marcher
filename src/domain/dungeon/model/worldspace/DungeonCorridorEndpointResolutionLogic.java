package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorEndpointMaterialization;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.CorridorResolvedEndpoint;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

/**
 * Owns authored corridor endpoint resolution and materialization.
 */
public final class DungeonCorridorEndpointResolutionLogic {

    private static final DungeonMapLookupAdapter LOOKUP_ADAPTER = new DungeonMapLookupAdapter();

    @Nullable
    ResolvedEndpointResult resolve(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint,
            CorridorHostCells hostCells
    ) {
        java.util.Objects.requireNonNull(dungeonMap, "dungeonMap");
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
        DungeonRoomCluster cluster = LOOKUP_ADAPTER.cluster(dungeonMap, endpoint.clusterId());
        if (cluster == null) {
            return null;
        }
        Edge edge = Edge.sideOf(endpoint.roomCell(), endpoint.direction());
        DungeonMap mapped = ensureDoorBoundary(dungeonMap, endpoint.clusterId(), edge);
        DungeonRoomCluster mappedCluster = LOOKUP_ADAPTER.cluster(mapped, endpoint.clusterId());
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
                CorridorResolvedEndpoint.forDoor(binding.toCore(), DungeonCorridorSemanticsRules.doorSemantics(binding)),
                binding);
    }

    private static @Nullable ResolvedEndpointResult resolveAnchorEndpoint(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint,
            CorridorHostCells hostCells
    ) {
        CorridorAnchorEndpointMaterialization.AuthoredEndpointMaterialization resolved =
                CorridorAnchorEndpointMaterialization.materializeAuthored(dungeonMap.corridors(), endpoint, hostCells);
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
        return new ResolvedEndpointResult(resolvedMap, resolvedAnchor(resolved.anchorBinding()), null);
    }

    private static DungeonMap ensureDoorBoundary(DungeonMap dungeonMap, long clusterId, Edge edge) {
        DungeonClusterBoundary existing = boundaryAt(dungeonMap, clusterId, edge);
        if (existing != null && existing.isDoor()) {
            return dungeonMap;
        }
        return new DungeonRoomTopologyEditor().editBoundaries(
                dungeonMap,
                clusterId,
                List.of(edge),
                BoundaryKind.DOOR,
                false);
    }

    @Nullable
    private static DungeonClusterBoundary boundaryAt(DungeonMap dungeonMap, long clusterId, Edge edge) {
        DungeonRoomCluster cluster = LOOKUP_ADAPTER.cluster(dungeonMap, clusterId);
        if (cluster == null || edge == null) {
            return null;
        }
        for (List<DungeonClusterBoundary> boundaries : cluster.boundariesByLevel().values()) {
            for (DungeonClusterBoundary boundary : boundaries) {
                if (boundary.matchesAbsoluteEdge(cluster.center(), edge)) {
                    return boundary;
                }
            }
        }
        return null;
    }

    private static CorridorResolvedEndpoint resolvedAnchor(CorridorAnchorBinding binding) {
        CorridorAnchorRef ref = new CorridorAnchorRef(binding.hostCorridorId(), binding.topologyRef().id());
        return CorridorResolvedEndpoint.forAnchor(ref);
    }

    public record ResolvedEndpointResult(
            DungeonMap map,
            CorridorResolvedEndpoint endpoint,
            @Nullable CorridorDoorBindingState replacementDoor
    ) {
        public Corridor applyTo(Corridor corridor) {
            return corridor.withResolvedEndpoint(endpoint, replacementDoor);
        }
    }

}
