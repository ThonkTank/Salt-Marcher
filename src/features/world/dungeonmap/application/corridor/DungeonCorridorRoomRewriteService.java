package features.world.dungeonmap.application.corridor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorRoomRewriteService {

    public Map<Long, Corridor> applyRoomRewrite(
            DungeonLayout layout,
            Map<Long, Corridor> corridorsById,
            ClusterRewrite rewrite
    ) {
        if (layout == null || corridorsById == null || corridorsById.isEmpty() || rewrite == null || rewrite.isNoOp()) {
            return corridorsById == null ? Map.of() : Map.copyOf(corridorsById);
        }
        Map<Long, Corridor> result = new LinkedHashMap<>(corridorsById);
        applyMergedRoomRewrite(result, rewrite);
        applyDeletedRoomRewrite(result, rewrite.deletedRoomIds());
        applySplitRoomRewrite(layout, result, rewrite);
        return Map.copyOf(result);
    }

    Map<Long, Corridor> removeRooms(
            Map<Long, Corridor> corridorsById,
            Set<Long> deletedRoomIds
    ) {
        if (corridorsById == null || corridorsById.isEmpty() || deletedRoomIds == null || deletedRoomIds.isEmpty()) {
            return corridorsById == null ? Map.of() : Map.copyOf(corridorsById);
        }
        Map<Long, Corridor> result = new LinkedHashMap<>(corridorsById);
        applyDeletedRoomRewrite(result, deletedRoomIds);
        return Map.copyOf(result);
    }

    Map<Long, Corridor> replaceSplitRoom(
            DungeonLayout layout,
            Map<Long, Corridor> corridorsById,
            Long originalRoomId,
            List<Room> fragments
    ) {
        if (layout == null || corridorsById == null || corridorsById.isEmpty() || originalRoomId == null || fragments == null || fragments.isEmpty()) {
            return corridorsById == null ? Map.of() : Map.copyOf(corridorsById);
        }
        Map<Long, Corridor> result = new LinkedHashMap<>(corridorsById);
        for (Long corridorId : layout.corridorIdsAffectedBy(Set.of(originalRoomId), Set.of())) {
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

    private void applyMergedRoomRewrite(Map<Long, Corridor> corridorsById, ClusterRewrite rewrite) {
        Long replacementRoomId = mergedReplacementRoomId(rewrite);
        if (replacementRoomId == null || rewrite.mergedRoomIds().isEmpty()) {
            return;
        }
        for (Map.Entry<Long, Corridor> entry : corridorsById.entrySet()) {
            Corridor corridor = entry.getValue();
            if (corridor == null || !corridor.isAffectedByRoomRewrite(rewrite.mergedRoomIds())) {
                continue;
            }
            entry.setValue(corridor.withMergedRooms(rewrite.mergedRoomIds(), replacementRoomId));
        }
    }

    private void applyDeletedRoomRewrite(Map<Long, Corridor> corridorsById, Set<Long> deletedRoomIds) {
        if (deletedRoomIds == null || deletedRoomIds.isEmpty()) {
            return;
        }
        for (Long roomId : deletedRoomIds) {
            for (Map.Entry<Long, Corridor> entry : corridorsById.entrySet()) {
                Corridor corridor = entry.getValue();
                if (corridor == null || !corridor.connectsRoom(roomId)) {
                    continue;
                }
                entry.setValue(corridor.withRemovedRoom(roomId));
            }
        }
    }

    private void applySplitRoomRewrite(
            DungeonLayout layout,
            Map<Long, Corridor> corridorsById,
            ClusterRewrite rewrite
    ) {
        for (Map.Entry<Long, List<Room>> entry : rewrite.splitFragmentsBySourceRoomId().entrySet()) {
            if (entry.getValue().size() <= 1) {
                continue;
            }
            Long originalRoomId = entry.getKey();
            for (Long corridorId : layout.corridorIdsAffectedBy(Set.of(originalRoomId), Set.of())) {
                Corridor corridor = corridorsById.get(corridorId);
                if (corridor == null || !corridor.connectsRoom(originalRoomId)) {
                    continue;
                }
                Room target = chooseBestFragment(layout, corridor, originalRoomId, entry.getValue());
                if (target != null && target.roomId() != null) {
                    corridorsById.put(corridorId, corridor.withReplacedRoom(originalRoomId, target.roomId()));
                }
            }
        }
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

    private static Long mergedReplacementRoomId(ClusterRewrite rewrite) {
        Set<Long> replacementIds = rewrite.replacedRoomIds().entrySet().stream()
                .filter(entry -> rewrite.mergedRoomIds().contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .filter(Objects::nonNull)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return replacementIds.size() == 1 ? replacementIds.iterator().next() : null;
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
