package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/**
 * Owns authored corridor endpoint resolution and materialization.
 */
public final class DungeonCorridorEndpointResolutionLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonMapLookupLogic LOOKUP_SERVICE = new DungeonMapLookupLogic();

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
        DungeonRoomCluster cluster = LOOKUP_SERVICE.cluster(dungeonMap, endpoint.clusterId());
        if (cluster == null) {
            return null;
        }
        DungeonEdge edge = DungeonEdge.sideOf(endpoint.roomCell(), endpoint.direction());
        DungeonMap mapped = ensureDoorBoundary(dungeonMap, endpoint.clusterId(), edge);
        DungeonRoomCluster mappedCluster = LOOKUP_SERVICE.cluster(mapped, endpoint.clusterId());
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
        return new ResolvedEndpointResult(mapped, ResolvedCorridorEndpoint.forDoor(binding));
    }

    private static @Nullable ResolvedEndpointResult resolveAnchorEndpoint(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint
    ) {
        DungeonCorridor host = LOOKUP_SERVICE.corridor(dungeonMap, endpoint.hostCorridorId());
        if (host == null) {
            return null;
        }
        Map<Long, List<DungeonCell>> cellsByCorridor =
                CONNECTION_NORMALIZATION_SERVICE.corridorCellsByCorridor(dungeonMap, dungeonMap.connections().corridors());
        List<DungeonCell> hostCells = cellsByCorridor.getOrDefault(host.corridorId(), List.of());
        if (hostCells.isEmpty()) {
            return null;
        }
        DungeonCell anchorCell = CONNECTION_NORMALIZATION_SERVICE.snapToHostCorridorCell(endpoint.anchorCell(), hostCells);
        DungeonCorridorAnchorBinding existing = findAnchorBinding(host, endpoint.topologyRef(), anchorCell);
        if (existing != null) {
            return new ResolvedEndpointResult(dungeonMap, ResolvedCorridorEndpoint.forAnchor(existing));
        }
        long anchorId = nextAnchorId(dungeonMap);
        DungeonCorridorAnchorBinding created = new DungeonCorridorAnchorBinding(
                anchorId,
                host.corridorId(),
                anchorCell,
                endpoint.topologyRef().present() ? endpoint.topologyRef() : DungeonTopologyRef.corridorAnchor(anchorId));
        List<DungeonCorridor> updatedCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            updatedCorridors.add(corridor.corridorId() == host.corridorId()
                    ? corridor.withAnchorBinding(created)
                    : corridor);
        }
        DungeonMap mapped = copyWithUnprunedConnections(
                dungeonMap,
                new ConnectionCatalog(
                        List.copyOf(updatedCorridors),
                        dungeonMap.connections().stairs(),
                        dungeonMap.connections().transitions()));
        DungeonCorridorAnchorBinding resolved = findAnchorBinding(
                LOOKUP_SERVICE.corridor(mapped, host.corridorId()),
                created.topologyRef(),
                created.absoluteCell());
        return resolved == null ? null : new ResolvedEndpointResult(mapped, ResolvedCorridorEndpoint.forAnchor(resolved));
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
        DungeonRoomCluster cluster = LOOKUP_SERVICE.cluster(dungeonMap, clusterId);
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

    @Nullable
    private static DungeonCorridorAnchorBinding findAnchorBinding(
            @Nullable DungeonCorridor host,
            DungeonTopologyRef topologyRef,
            DungeonCell anchorCell
    ) {
        if (host == null) {
            return null;
        }
        for (DungeonCorridorAnchorBinding binding : host.bindings().anchorBindings()) {
            if (binding != null && binding.matches(topologyRef, anchorCell)) {
                return binding;
            }
        }
        return null;
    }

    private static long nextAnchorId(DungeonMap dungeonMap) {
        long result = 0L;
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (corridor == null) {
                continue;
            }
            for (DungeonCorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
                if (binding != null && binding.anchorId() > result) {
                    result = binding.anchorId();
                }
            }
        }
        return result + 1L;
    }

    private static DungeonMap copyWithUnprunedConnections(DungeonMap dungeonMap, ConnectionCatalog nextConnections) {
        return new DungeonMap(
                dungeonMap.metadata(),
                dungeonMap.topology(),
                dungeonMap.topologyIndex(),
                dungeonMap.spaces(),
                dungeonMap.rooms(),
                nextConnections,
                dungeonMap.features(),
                dungeonMap.revision() + 1L);
    }

    public record ResolvedEndpointResult(DungeonMap map, ResolvedCorridorEndpoint endpoint) {
    }

    public record ResolvedCorridorEndpoint(
            @Nullable Long roomId,
            @Nullable DungeonCorridorDoorBinding doorBinding,
            @Nullable DungeonCorridorAnchorRef anchorRef
    ) {
        static ResolvedCorridorEndpoint forDoor(DungeonCorridorDoorBinding binding) {
            return new ResolvedCorridorEndpoint(binding.roomId(), binding, null);
        }

        static ResolvedCorridorEndpoint forAnchor(DungeonCorridorAnchorBinding binding) {
            return new ResolvedCorridorEndpoint(null, null, new DungeonCorridorAnchorRef(binding.hostCorridorId(), binding.topologyRef()));
        }

        public DungeonCorridor applyTo(DungeonCorridor corridor) {
            DungeonCorridor updated = corridor;
            if (doorBinding != null) {
                updated = updated.withDoorBinding(doorBinding);
            }
            if (anchorRef != null && anchorRef.present()) {
                updated = updated.withAnchorRef(anchorRef);
            }
            return updated;
        }
    }
}
