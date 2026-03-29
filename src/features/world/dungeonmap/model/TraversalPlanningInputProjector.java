package features.world.dungeonmap.model;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.TraversalPlanningInput;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TraversalPlanningInputProjector {

    private TraversalPlanningInputProjector() {
    }

    public static TraversalPlanningInput project(DungeonLayout layout) {
        if (layout == null) {
            return TraversalPlanningInput.empty();
        }
        Map<Long, Room> roomsById = new LinkedHashMap<>();
        Map<Long, Point2i> clusterCenters = new LinkedHashMap<>();
        Map<Long, Set<Integer>> roomLevels = new LinkedHashMap<>();
        List<DungeonStair> stairs = layout.stairs();
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
        return new TraversalPlanningInput(roomsById, clusterCenters, roomLevels, stairs);
    }

    public static TraversalPlanningInput project(List<RoomCluster> clusters) {
        return project(clusters, List.of());
    }

    public static TraversalPlanningInput project(List<RoomCluster> clusters, List<DungeonStair> stairs) {
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
        return new TraversalPlanningInput(roomsById, clusterCenters, roomLevels, stairs);
    }
}
