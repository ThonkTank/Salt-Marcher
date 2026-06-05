package src.domain.dungeon.model.worldspace;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.structure.DungeonMapLookupAdapter;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.CorridorResolvedEndpoint;

/**
 * Owns authored corridor endpoint resolution and materialization.
 */
public final class DungeonCorridorEndpointResolutionLogic {

    private static final DungeonCorridorHostCellsAdapter HOST_CELLS_ADAPTER = new DungeonCorridorHostCellsAdapter();
    private static final DungeonCorridorAnchorEndpointAdapter ANCHOR_ENDPOINT_ADAPTER =
            new DungeonCorridorAnchorEndpointAdapter();
    private static final DungeonMapLookupAdapter LOOKUP_ADAPTER = new DungeonMapLookupAdapter();

    public @Nullable ResolvedEndpointResult resolve(DungeonMap dungeonMap, DungeonCorridorEndpoint endpoint) {
        java.util.Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (endpoint == null || !endpoint.present()) {
            return null;
        }
        if (endpoint.isDoorEndpoint()) {
            return resolveDoorEndpoint(dungeonMap, endpoint);
        }
        if (endpoint.isAnchorEndpoint()) {
            return resolveAnchorEndpoint(dungeonMap, endpoint);
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
        DungeonEdge edge = DungeonEdge.sideOf(endpoint.roomCell(), endpoint.direction());
        DungeonMap mapped = ensureDoorBoundary(dungeonMap, endpoint.clusterId(), edge);
        DungeonRoomCluster mappedCluster = LOOKUP_ADAPTER.cluster(mapped, endpoint.clusterId());
        DungeonClusterBoundary boundary = boundaryAt(mapped, endpoint.clusterId(), edge);
        if (mappedCluster == null || boundary == null || !boundary.isDoor()) {
            return null;
        }
        DungeonCorridorDoorBinding binding = new DungeonCorridorDoorBinding(
                endpoint.roomId(),
                endpoint.clusterId(),
                new DungeonCell(
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
            DungeonCorridorEndpoint endpoint
    ) {
        DungeonCorridor host = LOOKUP_ADAPTER.corridor(dungeonMap, endpoint.hostCorridorId());
        if (host == null) {
            return null;
        }
        CorridorHostCells hostCells =
                HOST_CELLS_ADAPTER.hostCells(dungeonMap, dungeonMap.connections().corridors());
        DungeonCorridorAnchorEndpointAdapter.AnchorEndpointResult resolved =
                ANCHOR_ENDPOINT_ADAPTER.materialize(dungeonMap, endpoint, hostCells);
        return resolved == null
                ? null
                : new ResolvedEndpointResult(resolved.map(), resolvedAnchor(resolved.anchorBinding()), null);
    }

    private static DungeonMap ensureDoorBoundary(DungeonMap dungeonMap, long clusterId, DungeonEdge edge) {
        DungeonClusterBoundary existing = boundaryAt(dungeonMap, clusterId, edge);
        if (existing != null && existing.isDoor()) {
            return dungeonMap;
        }
        return new DungeonRoomTopologyEditor().editBoundaries(
                dungeonMap,
                clusterId,
                List.of(edge),
                DungeonClusterBoundaryKind.DOOR,
                false);
    }

    @Nullable
    private static DungeonClusterBoundary boundaryAt(DungeonMap dungeonMap, long clusterId, DungeonEdge edge) {
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

    private static CorridorResolvedEndpoint resolvedAnchor(DungeonCorridorAnchorBinding binding) {
        CorridorAnchorRef ref = new CorridorAnchorRef(binding.hostCorridorId(), binding.topologyRef().id());
        return CorridorResolvedEndpoint.forAnchor(ref);
    }

    public record ResolvedEndpointResult(
            DungeonMap map,
            CorridorResolvedEndpoint endpoint,
            @Nullable DungeonCorridorDoorBinding replacementDoor
    ) {
        public DungeonCorridor applyTo(DungeonCorridor corridor) {
            src.domain.dungeon.model.core.structure.corridor.Corridor coreCorridor =
                    endpoint.applyTo(DungeonCorridorCoreAdapter.toCore(corridor));
            return DungeonCorridorCoreAdapter.fromCore(corridor, coreCorridor, replacementDoor);
        }
    }
}
