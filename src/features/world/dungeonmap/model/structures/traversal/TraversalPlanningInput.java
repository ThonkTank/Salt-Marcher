package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.List;
import java.util.Map;
import java.util.Set;

public record TraversalPlanningInput(
        Map<Long, Room> roomsById,
        Map<Long, Point2i> clusterCenters,
        Map<Long, Set<Integer>> roomLevels,
        List<DungeonStair> stairs
) {
    public static TraversalPlanningInput empty() {
        return new TraversalPlanningInput(Map.of(), Map.of(), Map.of(), List.of());
    }

    public TraversalPlanningInput {
        roomsById = roomsById == null ? Map.of() : Map.copyOf(roomsById);
        clusterCenters = clusterCenters == null ? Map.of() : Map.copyOf(clusterCenters);
        roomLevels = roomLevels == null ? Map.of() : Map.copyOf(roomLevels);
        stairs = stairs == null ? List.of() : List.copyOf(stairs);
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
}
