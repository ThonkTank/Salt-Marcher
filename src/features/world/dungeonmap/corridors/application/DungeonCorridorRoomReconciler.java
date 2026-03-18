package features.world.dungeonmap.corridors.application;
import features.world.dungeonmap.layout.application.DungeonTopologyEditResultLoader;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.application.DungeonClusterRoomReconciler;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.corridors.persistence.DungeonCorridorPersistenceRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DungeonCorridorRoomReconciler {

    public void reassignMergedRoomCorridors(Connection conn, DungeonLayout layout, Long primaryRoomId, List<DungeonRoom> mergedRooms) throws SQLException {
        if (primaryRoomId == null) {
            return;
        }
        Set<Long> mergedRoomIds = mergedRooms.stream()
                .map(DungeonRoom::roomId)
                .filter(id -> id != null)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        for (DungeonCorridor corridor : layout.corridors()) {
            if (corridor.corridorId() == null) {
                continue;
            }
            if (corridor.roomIds().stream().noneMatch(mergedRoomIds::contains)) {
                continue;
            }
            List<Long> replacedRoomIds = corridor.roomIds().stream()
                    .map(roomId -> mergedRoomIds.contains(roomId) ? primaryRoomId : roomId)
                    .distinct()
                    .toList();
            DungeonCorridorPersistenceRepository.replaceCorridorRooms(conn, layout.map().mapId(), corridor.corridorId(), replacedRoomIds);
        }
    }

    public void reconcileRoomCorridors(Connection conn, long mapId, long originalRoomId, List<DungeonRoom> fragments) throws SQLException {
        if (fragments.isEmpty()) {
            return;
        }
        DungeonLayout currentLayout = DungeonTopologyEditResultLoader.requireLayout(conn, mapId);
        for (DungeonCorridor corridor : currentLayout.corridors()) {
            if (corridor.corridorId() == null) {
                continue;
            }
            if (!corridor.roomIds().contains(originalRoomId)) {
                continue;
            }
            DungeonRoom targetFragment = chooseBestCorridorFragment(currentLayout, corridor, originalRoomId, fragments);
            List<Long> replacedRoomIds = corridor.roomIds().stream()
                    .map(roomId -> roomId == originalRoomId ? targetFragment.roomId() : roomId)
                    .distinct()
                    .toList();
            DungeonCorridorPersistenceRepository.replaceCorridorRooms(conn, mapId, corridor.corridorId(), replacedRoomIds);
        }
    }

    private static DungeonRoom chooseBestCorridorFragment(DungeonLayout layout, DungeonCorridor corridor, long originalRoomId, List<DungeonRoom> fragments) {
        DungeonRoom bestFragment = fragments.get(0);
        FragmentScore bestScore = null;
        for (DungeonRoom fragment : fragments) {
            int nearestRoomDistance = corridor.roomIds().stream()
                    .filter(roomId -> roomId != originalRoomId)
                    .map(layout::roomById)
                    .filter(java.util.Objects::nonNull)
                    .mapToInt(room -> DungeonClusterRoomReconciler.componentDistance(fragment, room))
                    .min()
                    .orElse(Integer.MAX_VALUE);
            int groupDistance = corridor.roomIds().stream()
                    .filter(roomId -> roomId != originalRoomId)
                    .map(layout::roomById)
                    .filter(java.util.Objects::nonNull)
                    .mapToInt(room -> DungeonClusterRoomReconciler.componentDistance(fragment, room))
                    .sum();
            FragmentScore score = new FragmentScore(nearestRoomDistance, groupDistance);
            if (bestScore == null || score.compareTo(bestScore) < 0) {
                bestFragment = fragment;
                bestScore = score;
            }
        }
        return bestFragment;
    }

    private record FragmentScore(int nearestRoomDistance, int groupDistance) implements Comparable<FragmentScore> {
        @Override
        public int compareTo(FragmentScore other) {
            int nearest = Integer.compare(nearestRoomDistance, other.nearestRoomDistance);
            if (nearest != 0) {
                return nearest;
            }
            return Integer.compare(groupDistance, other.groupDistance);
        }
    }
}
