package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record TraversalRoutingSnapshot(
        Map<Long, Room> roomsById,
        Map<Long, Point2i> clusterCenters,
        Map<Long, Set<Integer>> roomLevels,
        List<DungeonStair> stairs,
        Map<Long, Long> traversalIdByStairId
) {
    public static TraversalRoutingSnapshot empty() {
        return new TraversalRoutingSnapshot(Map.of(), Map.of(), Map.of(), List.of(), Map.of());
    }

    public static TraversalRoutingSnapshot fromLayout(DungeonLayout layout) {
        if (layout == null) {
            return empty();
        }
        Map<Long, Room> roomsById = new LinkedHashMap<>();
        Map<Long, Point2i> clusterCenters = new LinkedHashMap<>();
        Map<Long, Set<Integer>> roomLevels = new LinkedHashMap<>();
        List<DungeonStair> stairs = layout.stairs();
        Map<Long, Long> traversalIdByStairId = new LinkedHashMap<>();
        for (RoomCluster cluster : layout.clusters()) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            if (cluster.center() != null) {
                clusterCenters.put(cluster.clusterId(), cluster.center());
            }
            for (Room room : cluster.rooms()) {
                if (room != null && room.roomId() != null) {
                    roomsById.put(room.roomId(), room);
                    roomLevels.put(room.roomId(), layout.levelsForRoom(room.roomId()));
                }
            }
        }
        for (DungeonStair stair : stairs) {
            if (stair != null && stair.stairId() != null) {
                Long traversalId = layout.traversalIdForStair(stair.stairId());
                if (traversalId != null) {
                    traversalIdByStairId.put(stair.stairId(), traversalId);
                }
            }
        }
        return new TraversalRoutingSnapshot(roomsById, clusterCenters, roomLevels, stairs, traversalIdByStairId);
    }

    public static TraversalRoutingSnapshot fromClusters(List<RoomCluster> clusters) {
        return fromClusters(clusters, List.of());
    }

    public static TraversalRoutingSnapshot fromClusters(List<RoomCluster> clusters, List<DungeonStair> stairs) {
        Map<Long, Room> roomsById = new LinkedHashMap<>();
        Map<Long, Point2i> clusterCenters = new LinkedHashMap<>();
        Map<Long, Set<Integer>> roomLevels = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            if (cluster.center() != null) {
                clusterCenters.put(cluster.clusterId(), cluster.center());
            }
            for (Room room : cluster.rooms()) {
                if (room != null && room.roomId() != null) {
                    roomsById.put(room.roomId(), room);
                    roomLevels.put(room.roomId(), room.levels());
                }
            }
        }
        return new TraversalRoutingSnapshot(roomsById, clusterCenters, roomLevels, stairs, Map.of());
    }

    public TraversalRoutingSnapshot {
        roomsById = roomsById == null ? Map.of() : Map.copyOf(roomsById);
        clusterCenters = clusterCenters == null ? Map.of() : Map.copyOf(clusterCenters);
        roomLevels = roomLevels == null ? Map.of() : Map.copyOf(roomLevels);
        stairs = stairs == null ? List.of() : List.copyOf(stairs);
        traversalIdByStairId = traversalIdByStairId == null ? Map.of() : Map.copyOf(traversalIdByStairId);
    }

    public Room room(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public Point2i clusterCenter(Long clusterId) {
        return clusterId == null ? null : clusterCenters.get(clusterId);
    }

    public Set<Integer> roomLevels(Long roomId) {
        return roomId == null ? Set.of() : roomLevels.getOrDefault(roomId, Set.of(0));
    }

    public int roomLevel(Long roomId) {
        Set<Integer> levels = roomLevels(roomId);
        return levels.isEmpty() ? 0 : levels.stream().mapToInt(Integer::intValue).min().orElse(0);
    }

    public Long traversalIdForStair(Long stairId) {
        return stairId == null ? null : traversalIdByStairId.get(stairId);
    }
}
