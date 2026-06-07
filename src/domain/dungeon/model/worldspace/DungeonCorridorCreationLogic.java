package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.projection.DungeonDerivedStateProjection;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

final class DungeonCorridorCreationLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonCorridorEndpointResolutionLogic ENDPOINT_RESOLUTION_SERVICE =
            new DungeonCorridorEndpointResolutionLogic();
    private static final DungeonCorridorSemanticsRules CORRIDOR_SEMANTICS_POLICY =
            new DungeonCorridorSemanticsRules();
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
        if (!validCreateEndpoints(start, end) || CORRIDOR_SEMANTICS_POLICY.sameClusterOnly(dungeonMap, start, end)) {
            return dungeonMap;
        }
        CorridorHostCells initialHostCells = hostCells(dungeonMap, dungeonMap.corridors());
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
        Corridor corridor = bindEndpoints(startResolved, endResolved, start.level());
        corridor = ROUTE_SPLIT_SERVICE.bindInteriorRouteAnchors(
                endResolved.map(),
                corridor,
                routeCells,
                startResolved,
                endResolved);
        List<Corridor> nextCorridors = new ArrayList<>(endResolved.map().corridors());
        nextCorridors.add(corridor);
        StairCollection nextStairs = endResolved.map().stairs();
        if (!start.sameLevelAs(end)) {
            Cell upperExit = new Cell(
                    routeCells.getLast().q(),
                    routeCells.getLast().r(),
                    end.level());
            nextStairs = nextStairs.withCorridorBoundStair(
                    stairId,
                    endResolved.map().metadata().mapId().value(),
                    corridor.corridorId(),
                    routeCells,
                    upperExit);
        }
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                endResolved.map(),
                List.copyOf(nextCorridors),
                nextStairs,
                endResolved.map().transitionCatalog());
    }

    private static CorridorHostCells hostCells(DungeonMap dungeonMap, List<Corridor> corridors) {
        return new CorridorHostCells(DERIVED_STATE_PROJECTION.corridorCellsByCorridor(dungeonMap, corridors));
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

    private boolean validCreateEndpoints(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        return start != null && end != null && start.present() && end.present();
    }

    private boolean corridorAlreadyExists(
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved
    ) {
        return CORRIDOR_SEMANTICS_POLICY.matchingCorridorExists(
                endResolved.map().corridors(),
                startResolved.endpoint(),
                endResolved.endpoint());
    }

    private Corridor bindEndpoints(
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved,
            int level
    ) {
        Corridor corridor = new Corridor(
                nextCorridorId(endResolved.map()),
                endResolved.map().metadata().mapId().value(),
                level,
                roomIds(startResolved, endResolved),
                CorridorBindingState.empty());
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
        if (persistedRoomId(roomId) && !roomIds.contains(roomId)) {
            roomIds.add(roomId);
        }
    }

    private static boolean persistedRoomId(@Nullable Long roomId) {
        return roomId != null && roomId > 0L;
    }

    private static long nextCorridorId(DungeonMap dungeonMap) {
        long result = 0L;
        for (Corridor corridor : dungeonMap.corridors()) {
            if (corridor != null && corridor.corridorId() > result) {
                result = corridor.corridorId();
            }
        }
        return result + 1L;
    }
}
