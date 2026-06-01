package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;

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
        long waypointClusterId = waypointClusterId(startResolved.endpoint(), endResolved.endpoint());
        DungeonCell clusterCenter = clusterCenter(dungeonMap, waypointClusterId);
        if (clusterCenter == null) {
            return corridor;
        }
        DungeonCorridor updated = corridor;
        List<DungeonCorridorWaypoint> waypoints = new ArrayList<>();
        Set<DungeonTopologyRef> attachedRefs = new LinkedHashSet<>();
        for (int index = 1; index < routeCells.size() - 1; index++) {
            DungeonCorridorAnchorBinding anchor = routeAnchorAt(dungeonMap, routeCells.get(index));
            if (anchor != null && attachedRefs.add(anchor.topologyRef())) {
                updated = updated.withAnchorRef(new DungeonCorridorAnchorRef(anchor.hostCorridorId(), anchor.topologyRef()));
                waypoints.add(waypointFor(waypointClusterId, clusterCenter, anchor.absoluteCell()));
            }
        }
        return waypoints.isEmpty() ? updated : updated.withBindings(updated.bindings().withWaypoints(waypoints));
    }

    private static long waypointClusterId(
            DungeonCorridorEndpointResolutionLogic.ResolvedCorridorEndpoint start,
            DungeonCorridorEndpointResolutionLogic.ResolvedCorridorEndpoint end
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

    private static DungeonCorridorWaypoint waypointFor(
            long clusterId,
            DungeonCell clusterCenter,
            DungeonCell absoluteCell
    ) {
        return new DungeonCorridorWaypoint(
                clusterId,
                new DungeonCell(
                        absoluteCell.q() - clusterCenter.q(),
                        absoluteCell.r() - clusterCenter.r(),
                        absoluteCell.level()),
                absoluteCell.level());
    }

    @Nullable
    private static DungeonCorridorAnchorBinding routeAnchorAt(DungeonMap dungeonMap, DungeonCell cell) {
        DungeonCorridorAnchorBinding result = null;
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (DungeonCorridorAnchorBinding anchor : corridor.bindings().anchorBindings()) {
                if (anchor != null && anchor.absoluteCell().equals(cell) && betterAnchor(anchor, result)) {
                    result = anchor;
                }
            }
        }
        return result;
    }

    private static boolean betterAnchor(
            DungeonCorridorAnchorBinding candidate,
            @Nullable DungeonCorridorAnchorBinding current
    ) {
        if (current == null) {
            return true;
        }
        int hostComparison = Long.compare(candidate.hostCorridorId(), current.hostCorridorId());
        if (hostComparison != 0) {
            return hostComparison < 0;
        }
        int anchorComparison = Long.compare(candidate.anchorId(), current.anchorId());
        if (anchorComparison != 0) {
            return anchorComparison < 0;
        }
        return candidate.topologyRef().id() < current.topologyRef().id();
    }
}
