package features.world.dungeonmap.application.corridor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorSplitRewriteInput;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
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
        // Membership rewrite order stays application-owned; each individual rewrite rule lives on Corridor.
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
            if (corridor == null) {
                continue;
            }
            result.put(corridorId, corridor.rewrittenForSplit(
                    splitRewriteInput(corridor, layout, originalRoomId, fragments)));
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
            if (corridor == null || !corridor.dependsOnAnyRoom(rewrite.mergedRoomIds())) {
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
                if (corridor == null) {
                    continue;
                }
                corridorsById.put(corridorId, corridor.rewrittenForSplit(
                        splitRewriteInput(corridor, layout, originalRoomId, entry.getValue())));
            }
        }
    }

    private CorridorSplitRewriteInput splitRewriteInput(
            Corridor corridor,
            DungeonLayout layout,
            Long originalRoomId,
            List<Room> fragments
    ) {
        if (corridor == null || layout == null || originalRoomId == null || fragments == null || fragments.isEmpty()) {
            return new CorridorSplitRewriteInput(originalRoomId, fragments, List.of());
        }
        List<Point2i> connectedRoomCenters = new ArrayList<>();
        for (Long roomId : corridor.roomIds()) {
            if (Objects.equals(roomId, originalRoomId)) {
                continue;
            }
            Room room = layout.findRoom(roomId);
            if (room != null) {
                connectedRoomCenters.add(room.floor().shape().centerCell());
            }
        }
        return new CorridorSplitRewriteInput(originalRoomId, fragments, connectedRoomCenters);
    }

    private static Long mergedReplacementRoomId(ClusterRewrite rewrite) {
        Set<Long> replacementIds = rewrite.replacedRoomIds().entrySet().stream()
                .filter(entry -> rewrite.mergedRoomIds().contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .filter(Objects::nonNull)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return replacementIds.size() == 1 ? replacementIds.iterator().next() : null;
    }
}
