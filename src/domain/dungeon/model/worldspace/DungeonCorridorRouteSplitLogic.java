package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.corridor.CorridorEndpointBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoutePlan;

final class DungeonCorridorRouteSplitLogic {
    private static final int MINIMUM_INTERIOR_SPLIT_ROUTE_CELLS = 3;
    private static final long MISSING_CLUSTER_ID = 0L;

    DungeonCorridor bindInteriorRouteAnchors(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            List<DungeonCell> routeCells,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved
    ) {
        if (routeCells.size() < MINIMUM_INTERIOR_SPLIT_ROUTE_CELLS) {
            return corridor;
        }
        long waypointClusterId = waypointClusterId(
                startResolved.endpoint().binding(),
                endResolved.endpoint().binding());
        DungeonCell clusterCenter = clusterCenter(dungeonMap, waypointClusterId);
        if (clusterCenter == null) {
            return corridor;
        }
        CorridorRoutePlan routePlan = new CorridorRoutePlan(
                coreRouteCells(routeCells),
                waypointClusterId,
                clusterCenter.geometry());
        return corridor.withBindings(corridor.bindings().withInteriorRouteAnchors(routePlan, routeAnchors(dungeonMap)));
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
    private static DungeonCell clusterCenter(DungeonMap dungeonMap, long clusterId) {
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

    private static List<DungeonCorridorAnchorBinding> routeAnchors(DungeonMap dungeonMap) {
        List<DungeonCorridorAnchorBinding> result = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (DungeonCorridorAnchorBinding anchor : corridor.bindings().anchorBindings()) {
                if (anchor != null) {
                    result.add(anchor);
                }
            }
        }
        return List.copyOf(result);
    }

    private static List<Cell> coreRouteCells(List<DungeonCell> routeCells) {
        List<Cell> result = new ArrayList<>();
        for (DungeonCell cell : routeCells) {
            if (cell != null) {
                result.add(cell.geometry());
            }
        }
        return List.copyOf(result);
    }
}
