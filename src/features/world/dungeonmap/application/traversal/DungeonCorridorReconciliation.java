package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorReconciliation {

    private final DungeonCorridorWriteRepository corridorWriteRepository;

    public DungeonCorridorReconciliation(DungeonCorridorWriteRepository corridorWriteRepository) {
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
    }

    public void reconcile(
            Connection conn,
            Traversal traversal,
            List<CorridorTraversalSlice> corridorSlices,
            TraversalSegmentRefs existingRefs
    ) throws SQLException {
        if (traversal == null || traversal.traversalId() == null) {
            return;
        }
        Map<Long, String> existingById = existingCorridorIds(existingRefs);
        Set<Long> desiredIds = new LinkedHashSet<>();
        for (CorridorTraversalSlice corridorSlice : corridorSlices == null ? List.<CorridorTraversalSlice>of() : corridorSlices) {
            if (corridorSlice == null) {
                continue;
            }
            Long corridorId = corridorSlice.corridorId();
            if (corridorId == null || !existingById.containsKey(corridorId)) {
                corridorWriteRepository.insertTraversalCorridor(
                        conn,
                        traversal.mapId(),
                        traversal.traversalId(),
                        corridorSlice.segmentKey());
                continue;
            }
            desiredIds.add(corridorId);
            corridorWriteRepository.updateTraversalCorridorSegmentKey(conn, corridorId, corridorSlice.segmentKey());
        }
        for (Long corridorId : existingById.keySet()) {
            if (corridorId != null && !desiredIds.contains(corridorId)) {
                corridorWriteRepository.deleteCorridor(conn, corridorId);
            }
        }
    }

    private static Map<Long, String> existingCorridorIds(TraversalSegmentRefs existingRefs) {
        LinkedHashMap<Long, String> result = new LinkedHashMap<>();
        TraversalSegmentRefs resolvedIds = existingRefs == null ? TraversalSegmentRefs.empty() : existingRefs;
        for (Map.Entry<String, Long> entry : resolvedIds.corridorIdsBySegmentKey().entrySet()) {
            if (entry.getValue() != null) {
                result.put(entry.getValue(), entry.getKey());
            }
        }
        return result;
    }
}
