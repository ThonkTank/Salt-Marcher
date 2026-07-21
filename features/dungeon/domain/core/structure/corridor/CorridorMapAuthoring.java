package features.dungeon.domain.core.structure.corridor;

import java.util.List;
import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.CorridorEndpointResolution.ResolvedEndpointResult;
import features.dungeon.domain.core.structure.corridor.CorridorRouteValidation.RouteValidation;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog;

/**
 * Owns aggregate-level corridor authoring inside the core corridor structure.
 */
public final class CorridorMapAuthoring {
    private static final CorridorConnectionNormalization CONNECTION_NORMALIZATION =
            new CorridorConnectionNormalization();
    private static final CorridorEndpointMatching ENDPOINT_MATCHING =
            new CorridorEndpointMatching();
    private static final CorridorEndpointResolution ENDPOINT_RESOLUTION =
            new CorridorEndpointResolution();
    private static final CorridorRouteSplitting ROUTE_SPLITTING =
            new CorridorRouteSplitting();
    private static final CorridorCreationBinding CREATION_BINDING =
            new CorridorCreationBinding();
    private final CorridorRouteValidation routeValidation;
    private final CorridorDeletion deletion;

    public CorridorMapAuthoring(CorridorRoutingPolicy routingPolicy) {
        CorridorRoutingPolicy safePolicy = Objects.requireNonNull(routingPolicy, "routingPolicy");
        routeValidation = new CorridorRouteValidation(safePolicy);
        deletion = new CorridorDeletion(safePolicy);
    }

    public DungeonMap createCorridor(
            DungeonMap dungeonMap,
            IdentityReservation identities,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        Objects.requireNonNull(identities, "identities");
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (!validCreateEndpoints(start, end)
                || !identities.validFor(start, end)
                || ENDPOINT_MATCHING.sameClusterOnly(dungeonMap, start, end)) {
            return dungeonMap;
        }
        CorridorEndpointOrdering.OrderedEndpoints orderedEndpoints =
                CorridorEndpointOrdering.canonical(start, end);
        start = orderedEndpoints.start();
        end = orderedEndpoints.end();
        CorridorHostCells initialHostCells = hostCells(dungeonMap, dungeonMap.corridors());
        RouteValidation routeValidation = this.routeValidation.validate(dungeonMap, start, end, initialHostCells);
        if (!routeValidation.hasValidRoute()) {
            return dungeonMap;
        }
        List<Cell> routeCells = routeValidation.routeCells();
        ResolvedEndpointResult startResolved = ENDPOINT_RESOLUTION.resolve(
                dungeonMap,
                start,
                initialHostCells,
                identities.firstEndpointAnchorId(),
                identities.firstEndpointRoomIds());
        if (startResolved == null) {
            return dungeonMap;
        }
        CorridorHostCells resolvedHostCells =
                hostCellsForResolvedMap(dungeonMap, initialHostCells, startResolved.map());
        ResolvedEndpointResult endResolved = ENDPOINT_RESOLUTION.resolve(
                startResolved.map(),
                end,
                resolvedHostCells,
                identities.secondEndpointAnchorId(),
                identities.secondEndpointRoomIds());
        if (endResolved == null || ENDPOINT_MATCHING.sameEndpoint(startResolved.endpoint(), endResolved.endpoint())) {
            return dungeonMap;
        }
        if (ENDPOINT_MATCHING.matchingCorridorExists(
                endResolved.map().corridors(),
                startResolved.endpoint(),
                endResolved.endpoint())) {
            return dungeonMap;
        }
        Corridor corridor = CREATION_BINDING.bindEndpoints(
                startResolved, endResolved, start.level(), identities.corridorId());
        corridor = ROUTE_SPLITTING.bindInteriorRouteAnchors(
                endResolved.map(),
                corridor,
                routeCells,
                startResolved,
                endResolved);
        List<Corridor> nextCorridors = new java.util.ArrayList<>(endResolved.map().corridors());
        nextCorridors.add(corridor);
        StairCollection nextStairs = CREATION_BINDING.corridorBoundStairs(
                identities.stairId(),
                start,
                end,
                routeCells,
                endResolved,
                corridor,
                identities.stairExitIds());
        if (!start.sameLevelAs(end)) {
            var boundStair = nextStairs.stair(identities.stairId());
            if (boundStair == null
                    || boundStair.exits().stream().anyMatch(exit -> exit.exitId() <= 0L)) {
                return dungeonMap;
            }
        }
        return CONNECTION_NORMALIZATION.copyWithConnections(
                endResolved.map(),
                List.copyOf(nextCorridors),
                nextStairs,
                endResolved.map().transitionCatalog(),
                false);
    }

    public record IdentityReservation(
            long corridorId,
            long firstEndpointAnchorId,
            long secondEndpointAnchorId,
            long stairId,
            List<Long> stairExitIds,
            RoomTopologyWorkCatalog.ReservedIdentities firstEndpointRoomIds,
            RoomTopologyWorkCatalog.ReservedIdentities secondEndpointRoomIds
    ) {
        public IdentityReservation {
            if (corridorId <= 0L || firstEndpointAnchorId <= 0L || secondEndpointAnchorId <= 0L) {
                throw new IllegalArgumentException("corridor and anchor identities must be positive");
            }
            stairExitIds = stairExitIds == null ? List.of() : List.copyOf(stairExitIds);
            Objects.requireNonNull(firstEndpointRoomIds, "firstEndpointRoomIds");
            Objects.requireNonNull(secondEndpointRoomIds, "secondEndpointRoomIds");
        }

        boolean validFor(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
            if (start == null || end == null) {
                return false;
            }
            if (start.sameLevelAs(end)) {
                return true;
            }
            int requiredExitIds = Math.abs(start.level() - end.level()) + 1;
            return stairId > 0L
                    && stairExitIds.size() >= requiredExitIds
                    && stairExitIds.stream().allMatch(id -> id != null && id > 0L);
        }

        @Override
        public List<Long> stairExitIds() {
            return List.copyOf(stairExitIds);
        }
    }

    public DungeonMap deleteCorridor(
            DungeonMap dungeonMap,
            CorridorDeletionTarget target
    ) {
        return deletion.deleteCorridor(dungeonMap, target);
    }

    private static boolean validCreateEndpoints(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        return start != null && end != null && start.present() && end.present();
    }

    private static CorridorHostCells hostCells(DungeonMap dungeonMap, List<Corridor> corridors) {
        return new CorridorHostCells(CorridorRouteValidation.corridorCellsByCorridor(dungeonMap, corridors));
    }

    private static CorridorHostCells hostCellsForResolvedMap(
            DungeonMap sourceMap,
            CorridorHostCells sourceHostCells,
            DungeonMap resolvedMap
    ) {
        return resolvedMap == sourceMap
                ? sourceHostCells
                : hostCells(resolvedMap, resolvedMap.corridors());
    }

}
