package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonCorridorDoorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonTopologyRef;

/**
 * Owns authored corridor endpoint resolution and materialization.
 */
public final class DungeonCorridorEndpointResolutionService {

    private static final DungeonCorridorConnectionNormalizationService CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationService();
    private static final DungeonMapLookupService LOOKUP_SERVICE = new DungeonMapLookupService();

    public @Nullable ResolvedEndpointResult resolve(DungeonMap dungeonMap, DungeonCorridorEndpoint endpoint) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (endpoint == null || !endpoint.present()) {
            return null;
        }
        if (endpoint instanceof DungeonCorridorDoorEndpoint doorEndpoint) {
            return resolveDoorEndpoint(dungeonMap, doorEndpoint);
        }
        if (endpoint instanceof DungeonCorridorAnchorEndpoint anchorEndpoint) {
            return resolveAnchorEndpoint(dungeonMap, anchorEndpoint);
        }
        return null;
    }

    private static @Nullable ResolvedEndpointResult resolveDoorEndpoint(
            DungeonMap dungeonMap,
            DungeonCorridorDoorEndpoint endpoint
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
            DungeonCorridorAnchorEndpoint endpoint
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
            updatedCorridors.add(corridor.corridorId() == host.corridorId() ? corridor.withAnchorBinding(created) : corridor);
        }
        DungeonMap mapped = CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
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
        return dungeonMap.connections().corridors().stream()
                .flatMap(corridor -> corridor.bindings().anchorBindings().stream())
                .filter(Objects::nonNull)
                .mapToLong(DungeonCorridorAnchorBinding::anchorId)
                .max()
                .orElse(0L) + 1L;
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
