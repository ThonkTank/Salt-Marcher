package features.dungeon.domain.core.structure.corridor;

import java.util.List;
import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.CorridorEndpointResolution.ResolvedEndpointResult;
import features.dungeon.domain.core.structure.corridor.CorridorRouteValidation.RouteValidation;
import features.dungeon.domain.core.structure.stair.StairCollection;

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
            long stairId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (!validCreateEndpoints(start, end) || ENDPOINT_MATCHING.sameClusterOnly(dungeonMap, start, end)) {
            return dungeonMap;
        }
        CorridorHostCells initialHostCells = hostCells(dungeonMap, dungeonMap.corridors());
        RouteValidation routeValidation = this.routeValidation.validate(dungeonMap, start, end, initialHostCells);
        if (!routeValidation.hasValidRoute()) {
            return dungeonMap;
        }
        List<Cell> routeCells = routeValidation.routeCells();
        ResolvedEndpointResult startResolved = ENDPOINT_RESOLUTION.resolve(dungeonMap, start, initialHostCells);
        if (startResolved == null) {
            return dungeonMap;
        }
        ResolvedEndpointResult endResolved = ENDPOINT_RESOLUTION.resolve(
                startResolved.map(),
                end,
                hostCellsForResolvedMap(dungeonMap, initialHostCells, startResolved.map()));
        if (endResolved == null || ENDPOINT_MATCHING.sameEndpoint(startResolved.endpoint(), endResolved.endpoint())) {
            return dungeonMap;
        }
        if (ENDPOINT_MATCHING.matchingCorridorExists(
                endResolved.map().corridors(),
                startResolved.endpoint(),
                endResolved.endpoint())) {
            return dungeonMap;
        }
        Corridor corridor = CREATION_BINDING.bindEndpoints(startResolved, endResolved, start.level());
        corridor = ROUTE_SPLITTING.bindInteriorRouteAnchors(
                endResolved.map(),
                corridor,
                routeCells,
                startResolved,
                endResolved);
        List<Corridor> nextCorridors = new java.util.ArrayList<>(endResolved.map().corridors());
        nextCorridors.add(corridor);
        StairCollection nextStairs = CREATION_BINDING.corridorBoundStairs(
                stairId,
                start,
                end,
                routeCells,
                endResolved,
                corridor);
        return CONNECTION_NORMALIZATION.copyWithConnections(
                endResolved.map(),
                List.copyOf(nextCorridors),
                nextStairs,
                endResolved.map().transitionCatalog());
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
