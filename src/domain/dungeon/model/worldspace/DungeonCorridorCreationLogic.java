package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;

final class DungeonCorridorCreationLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonCorridorEndpointResolutionLogic ENDPOINT_RESOLUTION_SERVICE =
            new DungeonCorridorEndpointResolutionLogic();
    private static final DungeonCorridorSemanticsRules CORRIDOR_SEMANTICS_POLICY =
            new DungeonCorridorSemanticsRules();
    private static final DungeonCorridorMutationRules MUTATION_RULES = new DungeonCorridorMutationRules();
    private static final DungeonCorridorRouteValidationLogic ROUTE_VALIDATION_SERVICE =
            new DungeonCorridorRouteValidationLogic();
    private static final DungeonCorridorRouteSplitLogic ROUTE_SPLIT_SERVICE = new DungeonCorridorRouteSplitLogic();
    private static final DungeonDerivedStateProjection DERIVED_STATE_PROJECTION = new DungeonDerivedStateProjection();

    DungeonMap createCorridor(
            DungeonMap dungeonMap,
            long stairId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (!validCreateEndpoints(start, end) || MUTATION_RULES.sameClusterOnly(dungeonMap, start, end)) {
            return dungeonMap;
        }
        CorridorHostCells initialHostCells = hostCells(dungeonMap, dungeonMap.connections().corridors());
        DungeonCorridorRouteValidationLogic.CorridorRouteValidation routeValidation =
                ROUTE_VALIDATION_SERVICE.validateRoute(dungeonMap, start, end, initialHostCells);
        if (!routeValidation.hasValidRoute()) {
            return dungeonMap;
        }
        List<Cell> routeCells = routeValidation.routeCells();
        DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved =
                ENDPOINT_RESOLUTION_SERVICE.resolve(dungeonMap, start, initialHostCells);
        if (startResolved == null) {
            return dungeonMap;
        }
        DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved =
                ENDPOINT_RESOLUTION_SERVICE.resolve(
                        startResolved.map(),
                        end,
                        hostCellsForResolvedMap(dungeonMap, initialHostCells, startResolved.map()));
        if (endResolved == null || CORRIDOR_SEMANTICS_POLICY.sameEndpoint(startResolved.endpoint(), endResolved.endpoint())) {
            return dungeonMap;
        }
        if (corridorAlreadyExists(endResolved, startResolved)) {
            return dungeonMap;
        }
        DungeonCorridor corridor = bindEndpoints(startResolved, endResolved, start.level());
        corridor = ROUTE_SPLIT_SERVICE.bindInteriorRouteAnchors(
                endResolved.map(),
                corridor,
                routeCells,
                startResolved,
                endResolved);
        List<DungeonCorridor> nextCorridors = new ArrayList<>(endResolved.map().connections().corridors());
        nextCorridors.add(corridor);
        ConnectionCatalog nextConnections = new ConnectionCatalog(
                List.copyOf(nextCorridors),
                endResolved.map().connections().stairs(),
                endResolved.map().connections().transitions());
        if (!start.sameLevelAs(end)) {
            Cell upperExit = new Cell(
                    routeCells.getLast().q(),
                    routeCells.getLast().r(),
                    end.level());
            nextConnections = nextConnections.withStairs(
                    DungeonStair.withCorridorBound(
                            nextConnections.stairCollection(),
                            stairId,
                            endResolved.map().metadata().mapId().value(),
                            corridor.corridorId(),
                            routeCells,
                            upperExit));
        }
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                endResolved.map(),
                nextConnections);
    }

    private static CorridorHostCells hostCells(DungeonMap dungeonMap, List<DungeonCorridor> corridors) {
        return new CorridorHostCells(DERIVED_STATE_PROJECTION.corridorCellsByCorridor(dungeonMap, corridors));
    }

    private static CorridorHostCells hostCellsForResolvedMap(
            DungeonMap sourceMap,
            CorridorHostCells sourceHostCells,
            DungeonMap resolvedMap
    ) {
        return resolvedMap == sourceMap
                ? sourceHostCells
                : hostCells(resolvedMap, resolvedMap.connections().corridors());
    }

    private boolean validCreateEndpoints(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        return start != null && end != null && start.present() && end.present();
    }

    private boolean corridorAlreadyExists(
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved
    ) {
        return CORRIDOR_SEMANTICS_POLICY.matchingCorridorExists(
                endResolved.map().connections().corridors(),
                startResolved.endpoint(),
                endResolved.endpoint());
    }

    private DungeonCorridor bindEndpoints(
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved,
            int level
    ) {
        DungeonCorridor corridor = new DungeonCorridor(
                MUTATION_RULES.nextCorridorId(endResolved.map()),
                endResolved.map().metadata().mapId().value(),
                level,
                roomIds(startResolved, endResolved),
                DungeonCorridorBindings.empty());
        corridor = startResolved.applyTo(corridor);
        return endResolved.applyTo(corridor);
    }

    private List<Long> roomIds(
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved
    ) {
        List<Long> roomIds = new ArrayList<>();
        addRoomId(roomIds, startResolved.endpoint().roomId());
        addRoomId(roomIds, endResolved.endpoint().roomId());
        return List.copyOf(roomIds);
    }

    private void addRoomId(List<Long> roomIds, @Nullable Long roomId) {
        if (roomId != null && MUTATION_RULES.hasPersistedRoomId(roomId) && !roomIds.contains(roomId)) {
            roomIds.add(roomId);
        }
    }
}
