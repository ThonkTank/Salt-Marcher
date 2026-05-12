package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonRoomClusterWorkLogic {

    private static final DungeonRoomCellProjection CELL_PROJECTOR = new DungeonRoomCellProjection();

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
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        int level = cells.iterator().next().level();
        for (DungeonRoomTopologyClusterWork work : clusters == null ? List.<DungeonRoomTopologyClusterWork>of() : clusters) {
            if (work != null && intersects(work.cellsAt(level), cells)) {
                result.add(work);
            }
        }
        return List.copyOf(result);
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
        DungeonCell center = DungeonCellOrdering.sortedCells(cells).getFirst();
        return new DungeonRoomCluster(clusterId, mapId, center, Map.of(), Map.of());
    }

    private DungeonRoom newRoom(long roomId, long mapId, long clusterId, Set<DungeonCell> cells) {
        return new DungeonRoom(
                roomId,
                mapId,
                clusterId,
                "Raum " + roomId,
                DungeonRoomCellProjection.anchorsByLevel(cellsByLevel(cells)),
                DungeonRoomNarration.empty());
    }

    private Map<Integer, List<DungeonCell>> cellsByLevel(Iterable<DungeonCell> cells) {
        Map<Integer, List<DungeonCell>> grouped = new LinkedHashMap<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            List<DungeonCell> levelCells = grouped.get(cell.level());
            if (levelCells == null) {
                levelCells = new ArrayList<>();
                grouped.put(cell.level(), levelCells);
            }
            levelCells.add(cell);
        }
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), DungeonCellOrdering.sortedCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            List<DungeonRoom> clusterRooms = result.get(room.clusterId());
            if (clusterRooms == null) {
                clusterRooms = new ArrayList<>();
                result.put(room.clusterId(), clusterRooms);
            }
            clusterRooms.add(room);
        }
        return Map.copyOf(result);
    }

    record ClusterRoomIds(long clusterId, long roomId) {
    }

    static final class IdAllocation {

        private long nextClusterId;
        private long nextRoomId;

        IdAllocation(DungeonMap dungeonMap) {
            this.nextClusterId = nextClusterId(dungeonMap);
            this.nextRoomId = nextRoomId(dungeonMap);
        }

        private static long nextClusterId(DungeonMap dungeonMap) {
            long result = 0L;
            for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
                if (cluster != null && cluster.clusterId() > result) {
                    result = cluster.clusterId();
                }
            }
            return result + 1L;
        }

        private static long nextRoomId(DungeonMap dungeonMap) {
            long result = 0L;
            for (DungeonRoom room : dungeonMap.rooms().rooms()) {
                if (room != null && room.roomId() > result) {
                    result = room.roomId();
                }
            }
            return result + 1L;
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
