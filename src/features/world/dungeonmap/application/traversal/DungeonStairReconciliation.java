package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;
import features.world.dungeonmap.model.structures.traversal.TraversalStairSlice;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonStairReconciliation {

    private final DungeonStairWriteRepository stairWriteRepository;

    public DungeonStairReconciliation(DungeonStairWriteRepository stairWriteRepository) {
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
    }

    public void reconcile(
            Connection conn,
            Traversal traversal,
            List<TraversalStairSlice> stairSlices,
            TraversalSegmentRefs existingRefs
    ) throws SQLException {
        if (traversal == null || traversal.traversalId() == null) {
            return;
        }
        Map<Long, String> existingById = existingStairIds(existingRefs);
        Set<Long> desiredIds = new LinkedHashSet<>();
        for (TraversalStairSlice stairSlice : stairSlices == null ? List.<TraversalStairSlice>of() : stairSlices) {
            if (stairSlice == null || stairSlice.stair() == null) {
                continue;
            }
            DungeonStair stair = stairSlice.stair();
            long stairId;
            if (stairSlice.stairId() == null || !existingById.containsKey(stairSlice.stairId())) {
                stairId = stairWriteRepository.insertStair(
                        conn,
                        traversal.mapId(),
                        traversal.traversalId(),
                        stairSlice.segmentKey(),
                        stair);
            } else {
                stairId = stairSlice.stairId();
                stairWriteRepository.updateTraversalStair(conn, stairId, stairSlice.segmentKey(), stair);
            }
            desiredIds.add(stairId);
            stairWriteRepository.replacePathNodes(conn, stairId, stair.path());
            stairWriteRepository.replaceExits(conn, stairId, stair.exits());
        }
        for (Long stairId : existingById.keySet()) {
            if (stairId != null && !desiredIds.contains(stairId)) {
                stairWriteRepository.deleteStair(conn, stairId);
            }
        }
    }

    private static Map<Long, String> existingStairIds(TraversalSegmentRefs existingRefs) {
        LinkedHashMap<Long, String> result = new LinkedHashMap<>();
        TraversalSegmentRefs resolvedIds = existingRefs == null ? TraversalSegmentRefs.empty() : existingRefs;
        for (Map.Entry<String, Long> entry : resolvedIds.stairIdsBySegmentKey().entrySet()) {
            if (entry.getValue() != null) {
                result.put(entry.getValue(), entry.getKey());
            }
        }
        return result;
    }
}
