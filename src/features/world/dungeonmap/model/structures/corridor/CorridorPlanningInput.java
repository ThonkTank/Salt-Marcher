package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.Map;

/**
 * Minimal external facts that a self-managed corridor needs for replanning.
 *
 * <p>This input deliberately exposes only raw room and cluster-center lookups. Corridor-specific resolution stays on
 * {@link Corridor} so routing logic does not depend on a second mirrored world API.</p>
 */
public record CorridorPlanningInput(
        Map<Long, Room> roomsById,
        Map<Long, Point2i> clusterCenters,
        Map<Long, Integer> roomLevels
) {
    public static CorridorPlanningInput empty() {
        return new CorridorPlanningInput(Map.of(), Map.of(), Map.of());
    }

    public CorridorPlanningInput {
        roomsById = roomsById == null ? Map.of() : Map.copyOf(roomsById);
        clusterCenters = clusterCenters == null ? Map.of() : Map.copyOf(clusterCenters);
        roomLevels = roomLevels == null ? Map.of() : Map.copyOf(roomLevels);
    }

    public Room room(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public Point2i clusterCenter(Long clusterId) {
        return clusterId == null ? null : clusterCenters.get(clusterId);
    }

    public int roomLevel(Long roomId) {
        return roomId == null ? 0 : roomLevels.getOrDefault(roomId, 0);
    }
}
