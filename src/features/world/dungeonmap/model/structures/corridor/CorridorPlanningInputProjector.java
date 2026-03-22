package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Canonical world projector for {@link CorridorPlanningInput}.
 *
 * <p>Corridor planning consumes only room and cluster-center lookups, but those facts can come from the persisted
 * layout or from overlay states such as translated clusters, replacement rooms, replacement cluster centers,
 * room removals, or cluster removals. This projector is the single implementation that turns those world states
 * into planning input so corridor planning does not depend on duplicated projection loops spread across layout,
 * loading, and application code.</p>
 */
public final class CorridorPlanningInputProjector {

    private CorridorPlanningInputProjector() {
    }

    public static CorridorPlanningInput project(DungeonLayout layout) {
        // CorridorPlanningInput is only external world projection, never a second owner of corridor rewrite rules.
        return layout == null ? CorridorPlanningInput.empty() : project(layout.clusters());
    }

    public static CorridorPlanningInput project(List<RoomCluster> clusters) {
        return project(clusters, Map.of(), Map.of(), Set.of(), Set.of());
    }

    public static CorridorPlanningInput projectOverlay(
            DungeonLayout layout,
            Map<Long, Room> replacementRooms,
            Map<Long, Point2i> replacementCenters,
            Set<Long> removedRoomIds,
            Set<Long> removedClusterIds
    ) {
        // Overlay snapshots stay projection-only: replacements/removals describe world state, not corridor decisions.
        return layout == null
                ? CorridorPlanningInput.empty()
                : project(layout.clusters(), replacementRooms, replacementCenters, removedRoomIds, removedClusterIds);
    }

    private static CorridorPlanningInput project(
            List<RoomCluster> clusters,
            Map<Long, Room> replacementRooms,
            Map<Long, Point2i> replacementCenters,
            Set<Long> removedRoomIds,
            Set<Long> removedClusterIds
    ) {
        Map<Long, Room> roomsById = new LinkedHashMap<>();
        Map<Long, Point2i> clusterCenters = new LinkedHashMap<>();
        Map<Long, Room> effectiveReplacementRooms = replacementRooms == null ? Map.of() : Map.copyOf(replacementRooms);
        Map<Long, Point2i> effectiveReplacementCenters = replacementCenters == null ? Map.of() : Map.copyOf(replacementCenters);
        Set<Long> removedRooms = removedRoomIds == null ? Set.of() : Set.copyOf(removedRoomIds);
        Set<Long> removedClusters = removedClusterIds == null ? Set.of() : Set.copyOf(removedClusterIds);
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            if (cluster == null || cluster.clusterId() == null || removedClusters.contains(cluster.clusterId())) {
                continue;
            }
            Point2i projectedCenter = effectiveReplacementCenters.getOrDefault(cluster.clusterId(), cluster.center());
            if (projectedCenter != null) {
                clusterCenters.put(cluster.clusterId(), projectedCenter);
            }
            for (Room room : cluster.rooms()) {
                if (room == null || room.roomId() == null || removedRooms.contains(room.roomId()) || removedClusters.contains(room.clusterId())) {
                    continue;
                }
                roomsById.put(room.roomId(), effectiveReplacementRooms.getOrDefault(room.roomId(), room));
            }
        }
        roomsById.putAll(effectiveReplacementRooms);
        for (Room room : effectiveReplacementRooms.values()) {
            if (room == null || removedClusters.contains(room.clusterId())) {
                continue;
            }
            Point2i projectedCenter = effectiveReplacementCenters.get(room.clusterId());
            if (projectedCenter != null) {
                clusterCenters.put(room.clusterId(), projectedCenter);
            }
        }
        return new CorridorPlanningInput(roomsById, clusterCenters);
    }
}
