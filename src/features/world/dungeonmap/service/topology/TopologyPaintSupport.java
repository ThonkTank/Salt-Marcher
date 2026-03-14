package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.editing.DungeonSquarePaint;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

final class TopologyPaintSupport {

    private TopologyPaintSupport() {
    }

    static List<DungeonSquarePaint> filledEdits(List<DungeonSquarePaint> edits) {
        List<DungeonSquarePaint> result = new ArrayList<>();
        for (DungeonSquarePaint edit : edits == null ? List.<DungeonSquarePaint>of() : edits) {
            if (edit.filled()) {
                result.add(edit);
            }
        }
        return result;
    }

    static List<Long> overlappedOwnerIds(
            List<DungeonSquarePaint> filledEdits,
            Function<String, Long> ownerIdByCoord
    ) {
        List<Long> result = new ArrayList<>();
        Set<Long> seen = new LinkedHashSet<>();
        for (DungeonSquarePaint edit : filledEdits == null ? List.<DungeonSquarePaint>of() : filledEdits) {
            Long ownerId = ownerIdByCoord == null ? null : ownerIdByCoord.apply(TopologyWorkspace.coordKey(edit.x(), edit.y()));
            if (ownerId != null && seen.add(ownerId)) {
                result.add(ownerId);
            }
        }
        return result;
    }

    static List<Long> prioritizeTargetEntity(long targetEntityId, List<Long> relatedEntityIds) {
        LinkedHashSet<Long> ordered = new LinkedHashSet<>();
        ordered.add(targetEntityId);
        if (relatedEntityIds != null) {
            ordered.addAll(relatedEntityIds);
        }
        return List.copyOf(ordered);
    }

    static SquarePaintOutcome classifySquarePaintOutcome(List<Long> overlappedEntityIds) {
        if (overlappedEntityIds == null || overlappedEntityIds.isEmpty()) {
            return SquarePaintOutcome.NEW_ROOM;
        }
        if (overlappedEntityIds.size() == 1) {
            return SquarePaintOutcome.EXTEND_EXISTING_ROOM;
        }
        return SquarePaintOutcome.MERGE_EXISTING_ROOMS;
    }
}
