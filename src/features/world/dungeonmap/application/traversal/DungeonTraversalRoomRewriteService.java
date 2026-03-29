package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalSplitRewriteInput;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonTraversalRoomRewriteService {

    public Map<Long, Traversal> applyRoomRewrite(
            DungeonLayout layout,
            Map<Long, Traversal> traversalsById,
            ClusterRewrite rewrite
    ) {
        if (layout == null || traversalsById == null || traversalsById.isEmpty() || rewrite == null || rewrite.isNoOp()) {
            return traversalsById == null ? Map.of() : Map.copyOf(traversalsById);
        }
        Map<Long, Traversal> result = new LinkedHashMap<>(traversalsById);
        applyMergedRoomRewrite(result, rewrite);
        applyDeletedRoomRewrite(result, rewrite.deletedRoomIds());
        applySplitRoomRewrite(layout, result, rewrite);
        return Map.copyOf(result);
    }

    private void applyMergedRoomRewrite(Map<Long, Traversal> traversalsById, ClusterRewrite rewrite) {
        Long replacementRoomId = mergedReplacementRoomId(rewrite);
        if (replacementRoomId == null || rewrite.mergedRoomIds().isEmpty()) {
            return;
        }
        for (Map.Entry<Long, Traversal> entry : traversalsById.entrySet()) {
            Traversal traversal = entry.getValue();
            if (traversal == null || !traversal.dependsOnAnyRoom(rewrite.mergedRoomIds())) {
                continue;
            }
            entry.setValue(traversal.withMergedRooms(rewrite.mergedRoomIds(), replacementRoomId));
        }
    }

    private void applyDeletedRoomRewrite(Map<Long, Traversal> traversalsById, Set<Long> deletedRoomIds) {
        if (deletedRoomIds == null || deletedRoomIds.isEmpty()) {
            return;
        }
        for (Long roomId : deletedRoomIds) {
            for (Map.Entry<Long, Traversal> entry : traversalsById.entrySet()) {
                Traversal traversal = entry.getValue();
                if (traversal == null || !traversal.connectsRoom(roomId)) {
                    continue;
                }
                entry.setValue(traversal.withRemovedRoom(roomId));
            }
        }
    }

    private void applySplitRoomRewrite(
            DungeonLayout layout,
            Map<Long, Traversal> traversalsById,
            ClusterRewrite rewrite
    ) {
        for (Map.Entry<Long, List<Room>> entry : rewrite.splitFragmentsBySourceRoomId().entrySet()) {
            if (entry.getValue().size() <= 1) {
                continue;
            }
            Long originalRoomId = entry.getKey();
            for (Long traversalId : layout.traversalIdsAffectedBy(Set.of(originalRoomId), Set.of())) {
                Traversal traversal = traversalsById.get(traversalId);
                if (traversal == null) {
                    continue;
                }
                traversalsById.put(traversalId, traversal.rewrittenForSplit(
                        splitRewriteInput(traversal, layout, originalRoomId, entry.getValue())));
            }
        }
    }

    private TraversalSplitRewriteInput splitRewriteInput(
            Traversal traversal,
            DungeonLayout layout,
            Long originalRoomId,
            List<Room> fragments
    ) {
        if (traversal == null || layout == null || originalRoomId == null || fragments == null || fragments.isEmpty()) {
            return new TraversalSplitRewriteInput(originalRoomId, fragments, List.of());
        }
        List<Point2i> connectedRoomCenters = new ArrayList<>();
        for (Long roomId : traversal.roomIds()) {
            if (Objects.equals(roomId, originalRoomId)) {
                continue;
            }
            Room room = layout.findRoom(roomId);
            if (room != null) {
                connectedRoomCenters.add(room.floor().shape().centerCell());
            }
        }
        return new TraversalSplitRewriteInput(originalRoomId, fragments, connectedRoomCenters);
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
