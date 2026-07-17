package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.CorridorEndpointResolution.ResolvedEndpointResult;
import features.dungeon.domain.core.structure.room.RoomCluster;

final class CorridorRouteSplitting {
    private static final int MINIMUM_INTERIOR_SPLIT_ROUTE_CELLS = 3;
    private static final long MISSING_CLUSTER_ID = 0L;

    Corridor bindInteriorRouteAnchors(
            DungeonMap dungeonMap,
            Corridor corridor,
            List<Cell> routeCells,
            ResolvedEndpointResult startResolved,
            ResolvedEndpointResult endResolved
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
        return corridor.withBindings(
                corridor.bindings().withInteriorRouteAnchors(routePlan, routeAnchors(dungeonMap)));
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
        RoomCluster target = CorridorMapLookup.cluster(dungeonMap, clusterId);
        return target == null ? null : target.center();
    }

    private static List<CorridorAnchor> routeAnchors(DungeonMap dungeonMap) {
        List<CorridorAnchor> result = new ArrayList<>();
        for (Corridor corridor : dungeonMap.corridors()) {
            for (CorridorAnchor anchor : corridor.bindings().anchorBindings()) {
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
