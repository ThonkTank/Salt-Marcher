package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;
import features.world.dungeonmap.persistence.DungeonTraversalCorridorSegmentWriteRepository;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonCorridorReconciliation {

    private final DungeonCorridorWriteRepository corridorWriteRepository;
    private final DungeonTraversalCorridorSegmentWriteRepository traversalSegmentWriteRepository;

    public DungeonCorridorReconciliation(
            DungeonCorridorWriteRepository corridorWriteRepository,
            DungeonTraversalCorridorSegmentWriteRepository traversalSegmentWriteRepository
    ) {
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
        this.traversalSegmentWriteRepository = Objects.requireNonNull(traversalSegmentWriteRepository, "traversalSegmentWriteRepository");
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
        LinkedHashMap<String, Long> desiredSegmentRefs = new LinkedHashMap<>();
        for (CorridorTraversalSlice corridorSlice : corridorSlices == null ? List.<CorridorTraversalSlice>of() : corridorSlices) {
            if (corridorSlice == null) {
                continue;
            }
            var corridor = features.world.dungeonmap.model.structures.corridor.Corridor.fromTraversalSlice(
                    corridorSlice,
                    traversal.traversalId(),
                    traversal.mapId(),
                    traversal.roomIds());
            if (corridor == null) {
                continue;
            }
            Long corridorId = corridorSlice.corridorId();
            if (corridorId == null || !existingById.containsKey(corridorId)) {
                corridorId = corridorWriteRepository.insertCorridor(
                        conn,
                        traversal.mapId(),
                        corridor);
            } else {
                corridorWriteRepository.updateCorridor(conn, corridorId, corridor);
            }
            corridorWriteRepository.replacePathNodes(conn, corridorId, corridor.path());
            corridorWriteRepository.replaceConnections(conn, corridorId, corridor.connections());
            desiredSegmentRefs.put(corridorSlice.segmentKey(), corridorId);
        }
        List<Long> removedCorridorIds = traversalSegmentWriteRepository.replaceTraversalSegments(
                conn,
                traversal.traversalId(),
                desiredSegmentRefs);
        for (Long corridorId : removedCorridorIds) {
            if (corridorId != null) {
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
