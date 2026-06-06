package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorEndpointBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoutePlan;

final class DungeonCorridorRouteSplitLogic {
    private static final int MINIMUM_INTERIOR_SPLIT_ROUTE_CELLS = 3;
    private static final long MISSING_CLUSTER_ID = 0L;

    Corridor bindInteriorRouteAnchors(
            DungeonMap dungeonMap,
            Corridor corridor,
            List<Cell> routeCells,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved
    ) {
        if (routeCells.size() < MINIMUM_INTERIOR_SPLIT_ROUTE_CELLS) {
            return corridor;
        }
        long waypointClusterId = waypointClusterId(
                startResolved.endpoint().binding(),
                endResolved.endpoint().binding());
        Cell clusterCenter = clusterCenter(dungeonMap, waypointClusterId);
        if (clusterCenter == null) {
            return corridor;
        }
        CorridorRoutePlan routePlan = new CorridorRoutePlan(
                nonNullRouteCells(routeCells),
                waypointClusterId,
                clusterCenter);
        return corridor.withStateBindings(
                corridor.stateBindings().withInteriorRouteAnchors(routePlan, routeAnchors(dungeonMap)));
    }

    private static long waypointClusterId(
            CorridorEndpointBinding start,
            CorridorEndpointBinding end
    ) {
        if (start.doorBinding() != null) {
            return start.doorBinding().clusterId();
        }
        if (end.doorBinding() != null) {
            return end.doorBinding().clusterId();
        }
        return MISSING_CLUSTER_ID;
    }

    @Nullable
    private static Cell clusterCenter(DungeonMap dungeonMap, long clusterId) {
        if (clusterId <= MISSING_CLUSTER_ID) {
            return null;
        }
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null && cluster.clusterId() == clusterId) {
                return cluster.center();
            }
        }
        return null;
    }

    private static List<CorridorAnchorBinding> routeAnchors(DungeonMap dungeonMap) {
        List<CorridorAnchorBinding> result = new ArrayList<>();
        for (Corridor corridor : dungeonMap.corridors()) {
            for (CorridorAnchorBinding anchor : corridor.stateBindings().anchorBindings()) {
                if (anchor != null) {
                    result.add(anchor);
                }
            }
        }
        return List.copyOf(result);
    }

    private static List<Cell> nonNullRouteCells(List<Cell> routeCells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : routeCells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }
}
