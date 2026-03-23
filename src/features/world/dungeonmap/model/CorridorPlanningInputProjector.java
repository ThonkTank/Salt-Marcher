package features.world.dungeonmap.model;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Canonical world projector for {@link CorridorPlanningInput}.
 *
 * <p>Corridor planning consumes only room and cluster-center lookups, but those facts can come from the persisted
 * layout. This projector is the single implementation that turns that layout-level state into planning input so
 * corridor planning does not depend on duplicated projection loops spread across layout and loading code.</p>
 */
public final class CorridorPlanningInputProjector {

    private CorridorPlanningInputProjector() {
    }

    public static CorridorPlanningInput project(DungeonLayout layout) {
        // CorridorPlanningInput is only external world projection, never a second owner of corridor rewrite rules.
        return layout == null ? CorridorPlanningInput.empty() : project(layout.clusters());
    }

    public static CorridorPlanningInput project(List<RoomCluster> clusters) {
        Map<Long, Room> roomsById = new LinkedHashMap<>();
        Map<Long, Point2i> clusterCenters = new LinkedHashMap<>();
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
                }
            }
        }
        return new CorridorPlanningInput(roomsById, clusterCenters);
    }
}
