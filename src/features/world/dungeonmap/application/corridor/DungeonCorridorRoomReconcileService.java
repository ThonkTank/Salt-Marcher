package features.world.dungeonmap.application.corridor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorRoomReconcileService {

    public Map<Long, Corridor> reassignMergedRoomCorridors(
            Map<Long, Corridor> corridorsById,
            Set<Long> mergedRoomIds,
            Long replacementRoomId
    ) {
        if (corridorsById == null || mergedRoomIds == null || mergedRoomIds.isEmpty() || replacementRoomId == null) {
            return corridorsById == null ? Map.of() : Map.copyOf(corridorsById);
        }
        Map<Long, Corridor> result = new LinkedHashMap<>(corridorsById);
        for (Long corridorId : result.keySet()) {
            if (!result.containsKey(corridorId)) {
                continue;
            }
            Corridor corridor = result.get(corridorId);
            if (corridor == null || !corridor.isAffectedByRoomRewrite(mergedRoomIds)) {
                continue;
            }
            result.put(corridorId, corridor.withMergedRooms(mergedRoomIds, replacementRoomId));
        }
        return Map.copyOf(result);
    }

    public Map<Long, Corridor> reconcileSplitRoomCorridors(
            DungeonLayout layout,
            Map<Long, Corridor> corridorsById,
            Long originalRoomId,
            List<Room> fragments
    ) {
        if (layout == null || corridorsById == null || originalRoomId == null || fragments == null || fragments.isEmpty()) {
            return corridorsById == null ? Map.of() : Map.copyOf(corridorsById);
        }
        Map<Long, Corridor> result = new LinkedHashMap<>(corridorsById);
        for (Long corridorId : layout.corridorIdsDependingOnRooms(Set.of(originalRoomId))) {
            Corridor corridor = result.get(corridorId);
            if (corridor == null || !corridor.connectsRoom(originalRoomId)) {
                continue;
            }
            Room target = chooseBestFragment(layout, corridor, originalRoomId, fragments);
            if (target != null && target.roomId() != null) {
                result.put(corridorId, corridor.withReplacedRoom(originalRoomId, target.roomId()));
            }
        }
        return Map.copyOf(result);
    }

    public Map<Long, Corridor> removeRoomFromCorridors(
            Map<Long, Corridor> corridorsById,
            Long roomId
    ) {
        if (corridorsById == null || roomId == null) {
            return corridorsById == null ? Map.of() : Map.copyOf(corridorsById);
        }
        Map<Long, Corridor> result = new LinkedHashMap<>(corridorsById);
        for (Map.Entry<Long, Corridor> entry : result.entrySet()) {
            Corridor corridor = entry.getValue();
            if (corridor == null || !corridor.connectsRoom(roomId)) {
                continue;
            }
            entry.setValue(corridor.withRemovedRoom(roomId));
        }
        return Map.copyOf(result);
    }

    private static Room chooseBestFragment(
            DungeonLayout layout,
            Corridor corridor,
            Long originalRoomId,
            List<Room> fragments
    ) {
        Room bestFragment = null;
        FragmentScore bestScore = null;
        for (Room fragment : fragments) {
            if (fragment == null || fragment.roomId() == null) {
                continue;
            }
            Point2i fragmentCenter = fragment.floor().shape().centerCell();
            int nearestRoomDistance = corridor.roomIds().stream()
                    .filter(roomId -> !Objects.equals(roomId, originalRoomId))
                    .map(layout::findRoom)
                    .filter(Objects::nonNull)
                    .mapToInt(room -> fragmentCenter.distanceTo(room.floor().shape().centerCell()))
                    .min()
                    .orElse(Integer.MAX_VALUE);
            int groupDistance = corridor.roomIds().stream()
                    .filter(roomId -> !Objects.equals(roomId, originalRoomId))
                    .map(layout::findRoom)
                    .filter(Objects::nonNull)
                    .mapToInt(room -> fragmentCenter.distanceTo(room.floor().shape().centerCell()))
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
