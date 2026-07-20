package features.dungeon.domain.core.projection;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomCellCoverage;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

public final class DungeonRoomBoundaryReadProjection {

    private final RoomCellCoverage roomCellCoverage = new RoomCellCoverage();

    public DungeonRoomBoundaryProjection project(List<RoomRegion> authoredRooms, SpatialTopology topology) {
        List<RoomRegion> safeRooms = authoredRooms == null ? List.of() : authoredRooms;
        SpatialTopology safeTopology = topology == null ? SpatialTopology.empty() : topology;
        Map<Long, RoomRegion> roomsById = roomsById(safeRooms);
        Map<Long, List<RoomRegion>> roomsByCluster = indexRoomsByCluster(safeRooms);
        Map<Long, RoomCluster> clustersById = clustersById(safeTopology.roomClusters());
        List<DungeonState> aggregates = new ArrayList<>();
        List<DungeonAreaFacts> areas = new ArrayList<>();
        Map<Long, List<Cell>> allRoomCells = new LinkedHashMap<>();
        DungeonRoomBoundaryProjectionState state = new DungeonRoomBoundaryProjectionState();
        for (RoomCluster cluster : safeTopology.roomClusters()) {
            List<RoomRegion> clusterRooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            Map<Long, List<Cell>> roomCells = roomCellCoverage.cellsByRoom(cluster, clusterRooms);
            allRoomCells.putAll(roomCells);
            DungeonRoomAggregateProjection.addRoomAggregates(aggregates, areas, cluster.clusterId(), clusterRooms, roomCells);
            state.addAuthoredBoundaries(cluster, roomCells);
            state.addPerimeterBoundaries(cluster, clusterRooms, roomCells);
        }
        DungeonBoundaryProjection boundaryProjection = state.toProjection();
        return new DungeonRoomBoundaryProjection(
                aggregates,
                areas,
                boundaryProjection.boundaries(),
                boundaryProjection.containment(),
                boundaryProjection.connections(),
                allRoomCells,
                boundaryProjection.boundaryIdsByKey(),
                roomsById,
                clustersById,
                boundaryProjection.nextBoundaryId());
    }

    private static Map<Long, List<RoomRegion>> indexRoomsByCluster(List<RoomRegion> rooms) {
        Map<Long, List<RoomRegion>> result = new LinkedHashMap<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null) {
                result.computeIfAbsent(room.clusterId(), unused -> new ArrayList<>()).add(room);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, RoomRegion> roomsById(List<RoomRegion> rooms) {
        Map<Long, RoomRegion> result = new LinkedHashMap<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            result.put(room.roomId(), room);
        }
        return Map.copyOf(result);
    }

    private static Map<Long, RoomCluster> clustersById(List<RoomCluster> clusters) {
        Map<Long, RoomCluster> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            result.put(cluster.clusterId(), cluster);
        }
        return Map.copyOf(result);
    }
}
