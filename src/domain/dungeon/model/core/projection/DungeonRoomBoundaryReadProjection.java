package src.domain.dungeon.model.core.projection;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonRoomCellProjection;

/**
 * Transitional projection boundary: remove the worldspace imports once
 * DungeonMap, SpatialTopology, DungeonRoom, DungeonRoomCluster, and
 * DungeonRoomCellProjection inputs have core structure owners and this reads
 * those owners directly.
 */
public final class DungeonRoomBoundaryReadProjection {

    private final DungeonRoomCellProjection roomCellProjector = new DungeonRoomCellProjection();

    public DungeonRoomBoundaryProjection project(DungeonMap dungeonMap, SpatialTopology topology) {
        List<DungeonRoom> authoredRooms = dungeonMap.rooms().rooms();
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(authoredRooms);
        Map<Long, DungeonRoom> roomsById = roomsById(authoredRooms);
        Map<Long, DungeonRoomCluster> clustersById = clustersById(topology.roomClusters());
        List<DungeonState> aggregates = new ArrayList<>();
        List<DungeonAreaFacts> areas = new ArrayList<>();
        Map<Long, List<Cell>> allRoomCells = new LinkedHashMap<>();
        DungeonRoomBoundaryProjectionState state = new DungeonRoomBoundaryProjectionState();
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            List<DungeonRoom> clusterRooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            Map<Long, List<Cell>> roomCells = roomCellProjector.cellsByRoom(cluster, clusterRooms);
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

    private static Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            List<DungeonRoom> clusterRooms = result.get(room.clusterId());
            if (clusterRooms == null) {
                clusterRooms = new ArrayList<>();
                result.put(room.clusterId(), clusterRooms);
            }
            clusterRooms.add(room);
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
