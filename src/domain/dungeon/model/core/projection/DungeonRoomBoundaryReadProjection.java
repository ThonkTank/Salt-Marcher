package src.domain.dungeon.model.core.projection;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomCellCoverage;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

public final class DungeonRoomBoundaryReadProjection {

    private final RoomCellCoverage roomCellCoverage = new RoomCellCoverage();

    public DungeonRoomBoundaryProjection project(List<DungeonRoom> authoredRooms, SpatialTopology topology) {
        List<DungeonRoom> safeRooms = authoredRooms == null ? List.of() : authoredRooms;
        SpatialTopology safeTopology = topology == null ? SpatialTopology.empty() : topology;
        Map<Long, DungeonRoom> roomsById = roomsById(safeRooms);
        Map<Long, List<DungeonRoom>> roomsByCluster = indexRoomsByCluster(safeRooms);
        Map<Long, DungeonRoomCluster> clustersById = clustersById(safeTopology.roomClusters());
        List<DungeonState> aggregates = new ArrayList<>();
        List<DungeonAreaFacts> areas = new ArrayList<>();
        Map<Long, List<Cell>> allRoomCells = new LinkedHashMap<>();
        DungeonRoomBoundaryProjectionState state = new DungeonRoomBoundaryProjectionState();
        for (DungeonRoomCluster cluster : safeTopology.roomClusters()) {
            List<DungeonRoom> clusterRooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
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

    private static Map<Long, List<DungeonRoom>> indexRoomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room != null) {
                result.computeIfAbsent(room.clusterId(), unused -> new ArrayList<>()).add(room);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonRoom> roomsById(List<DungeonRoom> rooms) {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            result.put(room.roomId(), room);
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonRoomCluster> clustersById(List<DungeonRoomCluster> clusters) {
        Map<Long, DungeonRoomCluster> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : clusters == null ? List.<DungeonRoomCluster>of() : clusters) {
            result.put(cluster.clusterId(), cluster);
        }
        return Map.copyOf(result);
    }
}
