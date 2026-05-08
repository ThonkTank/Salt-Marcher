package src.domain.dungeon.map.service;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.SpatialTopology;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonRoomBoundaryReadProjector {

    private final DungeonRoomCellProjector roomCellProjector = new DungeonRoomCellProjector();

    DungeonRoomBoundaryProjection project(DungeonMap dungeonMap, SpatialTopology topology) {
        List<DungeonRoom> authoredRooms = dungeonMap.rooms().rooms();
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(authoredRooms);
        Map<Long, DungeonRoom> roomsById = roomsById(authoredRooms);
        Map<Long, DungeonRoomCluster> clustersById = clustersById(topology.roomClusters());
        List<DungeonAggregate> aggregates = new ArrayList<>();
        List<DungeonAreaFacts> areas = new ArrayList<>();
        Map<Long, List<DungeonCell>> allRoomCells = new LinkedHashMap<>();
        DungeonRoomBoundaryProjectionState state = new DungeonRoomBoundaryProjectionState();
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            List<DungeonRoom> clusterRooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            Map<Long, List<DungeonCell>> roomCells = roomCellProjector.cellsByRoom(cluster, clusterRooms);
            allRoomCells.putAll(roomCells);
            DungeonRoomAggregateProjector.addRoomAggregates(aggregates, areas, cluster.clusterId(), clusterRooms, roomCells);
            state.addAuthoredBoundaries(cluster, roomCells);
            state.addPerimeterBoundaries(cluster, clusterRooms, roomCells);
        }
        DungeonBoundaryProjection boundaryProjection = state.toProjection();
        return new DungeonRoomBoundaryProjection(
                aggregates,
                boundaryProjection.primitives(),
                areas,
                boundaryProjection.boundaries(),
                boundaryProjection.containment(),
                boundaryProjection.connections(),
                allRoomCells,
                boundaryProjection.boundaryIdsByKey(),
                roomsById,
                clustersById,
                boundaryProjection.nextPrimitiveId());
    }

    private static Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
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
