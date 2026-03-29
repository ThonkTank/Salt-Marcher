package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;
import features.world.dungeonmap.persistence.DungeonTraversalStairSegmentWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonStairReconciliation {

    private final DungeonStairWriteRepository stairWriteRepository;
    private final DungeonTraversalStairSegmentWriteRepository traversalSegmentWriteRepository;

    public DungeonStairReconciliation(
            DungeonStairWriteRepository stairWriteRepository,
            DungeonTraversalStairSegmentWriteRepository traversalSegmentWriteRepository
    ) {
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
        this.traversalSegmentWriteRepository = Objects.requireNonNull(traversalSegmentWriteRepository, "traversalSegmentWriteRepository");
    }

    public void reconcile(
            Connection conn,
            Traversal traversal,
            List<TraversalRoute.StairSegment> stairSegments,
            TraversalSegmentRefs existingRefs
    ) throws SQLException {
        if (traversal == null || traversal.traversalId() == null) {
            return;
        }
        Map<Long, String> existingById = existingStairIds(existingRefs);
        LinkedHashMap<String, Long> desiredSegmentRefs = new LinkedHashMap<>();
        for (TraversalRoute.StairSegment stairSegment : stairSegments == null
                ? List.<TraversalRoute.StairSegment>of()
                : stairSegments) {
            if (stairSegment == null || stairSegment.stair() == null) {
                continue;
            }
            DungeonStair stair = stairSegment.stair();
            long stairId;
            if (stair.stairId() == null || !existingById.containsKey(stair.stairId())) {
                stairId = stairWriteRepository.insertStair(
                        conn,
                        traversal.mapId(),
                        stair);
            } else {
                stairId = stair.stairId();
                stairWriteRepository.updateStair(conn, stairId, stair);
            }
            stairWriteRepository.replacePathNodes(conn, stairId, stair.path());
            stairWriteRepository.replaceExits(conn, stairId, stair.exits());
            desiredSegmentRefs.put(stairSegment.segmentKey(), stairId);
        }
        List<Long> removedStairIds = traversalSegmentWriteRepository.replaceTraversalSegments(
                conn,
                traversal.traversalId(),
                desiredSegmentRefs);
        for (Long stairId : removedStairIds) {
            if (stairId != null) {
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
