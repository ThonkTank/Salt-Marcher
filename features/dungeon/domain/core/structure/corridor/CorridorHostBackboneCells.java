package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.room.DungeonRoomCluster;

final class CorridorHostBackboneCells {
    private static final int SINGLE_ROUTE_TERMINUS_COUNT = 1;
    private static final int FULL_ROUTE_TERMINUS_COUNT = 2;

    List<Cell> authoredBackbone(
            List<CorridorWaypoint> waypoints,
            Map<Long, DungeonRoomCluster> clustersById,
            List<CorridorHostEndpoint> endpoints
    ) {
        List<Cell> waypointCells = waypointCells(waypoints, clustersById);
        List<CorridorHostEndpoint> termini = routeTermini(endpoints);
        if (termini.isEmpty()) {
            return waypointCells;
        }
        List<Cell> result = new ArrayList<>();
        result.add(termini.getFirst().corridorCell());
        result.addAll(waypointCells);
        if (termini.size() > SINGLE_ROUTE_TERMINUS_COUNT) {
            result.add(termini.getLast().corridorCell());
        }
        return List.copyOf(result);
    }

    List<Cell> endpointBackbone(List<CorridorHostEndpoint> endpoints) {
        List<Cell> result = new ArrayList<>();
        for (CorridorHostEndpoint endpoint : endpoints == null ? List.<CorridorHostEndpoint>of() : endpoints) {
            if (endpoint != null) {
                result.add(endpoint.corridorCell());
            }
        }
        return List.copyOf(result);
    }

    private static List<CorridorHostEndpoint> routeTermini(List<CorridorHostEndpoint> endpoints) {
        List<CorridorHostEndpoint> doorEndpoints = new ArrayList<>();
        List<CorridorHostEndpoint> allEndpoints = new ArrayList<>();
        for (CorridorHostEndpoint endpoint : endpoints == null ? List.<CorridorHostEndpoint>of() : endpoints) {
            if (endpoint != null) {
                allEndpoints.add(endpoint);
                if (endpoint.door()) {
                    doorEndpoints.add(endpoint);
                }
            }
        }
        if (doorEndpoints.size() >= FULL_ROUTE_TERMINUS_COUNT) {
            return List.of(doorEndpoints.getFirst(), doorEndpoints.getLast());
        }
        if (allEndpoints.size() <= FULL_ROUTE_TERMINUS_COUNT) {
            return List.copyOf(allEndpoints);
        }
        return List.of(allEndpoints.getFirst(), allEndpoints.getLast());
    }

    private static List<Cell> waypointCells(
            List<CorridorWaypoint> waypoints,
            Map<Long, DungeonRoomCluster> clustersById
    ) {
        List<Cell> result = new ArrayList<>();
        for (CorridorWaypoint waypoint : waypoints == null ? List.<CorridorWaypoint>of() : waypoints) {
            result.add(absoluteWaypointCell(waypoint, clustersById));
        }
        return List.copyOf(result);
    }

    private static Cell absoluteWaypointCell(
            CorridorWaypoint waypoint,
            Map<Long, DungeonRoomCluster> clustersById
    ) {
        DungeonRoomCluster cluster = clustersById.get(waypoint.clusterId());
        Cell center = cluster == null
                ? new Cell(0, 0, waypoint.level())
                : cluster.center();
        return waypoint.absoluteCell(center);
    }
}
