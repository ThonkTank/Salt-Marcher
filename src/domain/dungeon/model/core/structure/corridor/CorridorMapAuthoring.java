package src.domain.dungeon.model.core.structure.corridor;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.corridor.CorridorEndpointResolution.ResolvedEndpointResult;
import src.domain.dungeon.model.core.structure.corridor.CorridorRouteValidation.RouteValidation;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

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
    private static final CorridorRouteValidation ROUTE_VALIDATION =
            new CorridorRouteValidation();
    private static final CorridorRouteSplitting ROUTE_SPLITTING =
            new CorridorRouteSplitting();
    private static final CorridorCreationBinding CREATION_BINDING =
            new CorridorCreationBinding();
    private static final CorridorDeletion DELETION =
            new CorridorDeletion();

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
        RouteValidation routeValidation = ROUTE_VALIDATION.validate(dungeonMap, start, end, initialHostCells);
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
            long corridorId,
            String targetKind,
            long topologyRefId,
            long roomId,
            int waypointIndex
    ) {
        return DELETION.deleteCorridor(
                dungeonMap,
                corridorId,
                targetKind,
                topologyRefId,
                roomId,
                waypointIndex);
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
