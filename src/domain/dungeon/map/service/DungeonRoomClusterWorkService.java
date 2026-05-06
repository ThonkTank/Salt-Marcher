package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;

final class DungeonRoomClusterWorkService {

    private static final DungeonRoomCellProjector CELL_PROJECTOR = new DungeonRoomCellProjector();

    List<DungeonRoomTopologyClusterWork> workClusters(DungeonMap dungeonMap) {
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(dungeonMap.rooms().rooms());
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> rooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            result.add(new DungeonRoomTopologyClusterWork(
                    cluster,
                    rooms,
                    CELL_PROJECTOR.cellsByLevel(cluster, rooms)));
        }
        return result;
    }

    List<DungeonRoomTopologyClusterWork> affectedClusters(
            List<DungeonRoomTopologyClusterWork> clusters,
            Set<DungeonCell> cells
    ) {
        return clusters.stream()
                .filter(work -> intersects(work.cellsAt(cells.iterator().next().level()), cells))
                .toList();
    }

    IdAllocation newIdAllocation(DungeonMap dungeonMap) {
        return new IdAllocation(dungeonMap);
    }

    DungeonRoomTopologyClusterWork newClusterWork(ClusterRoomIds ids, long mapId, Set<DungeonCell> cells) {
        return new DungeonRoomTopologyClusterWork(
                newCluster(ids.clusterId(), mapId, cells),
                List.of(newRoom(ids.roomId(), mapId, ids.clusterId(), cells)),
                cellsByLevel(cells));
    }

    boolean intersects(List<DungeonCell> left, Set<DungeonCell> right) {
        for (DungeonCell cell : left == null ? List.<DungeonCell>of() : left) {
            if (right.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    private DungeonRoomCluster newCluster(long clusterId, long mapId, Set<DungeonCell> cells) {
        DungeonCell center = DungeonRoomCellProjector.sortedCells(cells).getFirst();
        return new DungeonRoomCluster(clusterId, mapId, center, Map.of(), Map.of());
    }

    private DungeonRoom newRoom(long roomId, long mapId, long clusterId, Set<DungeonCell> cells) {
        return new DungeonRoom(
                roomId,
                mapId,
                clusterId,
                "Raum " + roomId,
                DungeonRoomCellProjector.anchorsByLevel(cellsByLevel(cells)),
                DungeonRoomNarration.empty());
    }

    private Map<Integer, List<DungeonCell>> cellsByLevel(Iterable<DungeonCell> cells) {
        Map<Integer, List<DungeonCell>> grouped = new LinkedHashMap<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            grouped.computeIfAbsent(cell.level(), ignored -> new ArrayList<>()).add(cell);
        }
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), DungeonRoomCellProjector.sortedCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
        }
        return Map.copyOf(result);
    }

    record ClusterRoomIds(long clusterId, long roomId) {
    }

    static final class IdAllocation {

        private long nextClusterId;
        private long nextRoomId;

        IdAllocation(DungeonMap dungeonMap) {
            this.nextClusterId = dungeonMap.topology().roomClusters().stream()
                    .mapToLong(DungeonRoomCluster::clusterId)
                    .max()
                    .orElse(0L) + 1L;
            this.nextRoomId = dungeonMap.rooms().rooms().stream()
                    .mapToLong(DungeonRoom::roomId)
                    .max()
                    .orElse(0L) + 1L;
        }

        ClusterRoomIds reserveClusterAndRoom() {
            ClusterRoomIds reserved = new ClusterRoomIds(nextClusterId, nextRoomId);
            nextClusterId += 1L;
            nextRoomId += 1L;
            return reserved;
        }

        long reserveRoomId() {
            long reserved = nextRoomId;
            nextRoomId += 1L;
            return reserved;
        }
    }
}
