package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.TraversalReadModelProjector;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentIds;
import features.world.dungeonmap.model.structures.traversal.TraversalStairSlice;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;
import features.world.dungeonmap.persistence.DungeonTraversalWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonTraversalPersistenceService {

    private final DungeonTraversalWriteRepository traversalWriteRepository;
    private final DungeonCorridorWriteRepository corridorWriteRepository;
    private final DungeonStairWriteRepository stairWriteRepository;

    public DungeonTraversalPersistenceService(
            DungeonTraversalWriteRepository traversalWriteRepository,
            DungeonCorridorWriteRepository corridorWriteRepository,
            DungeonStairWriteRepository stairWriteRepository
    ) {
        this.traversalWriteRepository = Objects.requireNonNull(traversalWriteRepository, "traversalWriteRepository");
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
    }

    public void persistTraversal(Connection conn, Traversal traversal) throws SQLException {
        persistTraversal(conn, null, traversal, TraversalPlan.empty());
    }

    public void persistTraversal(Connection conn, Traversal traversal, TraversalPlan traversalPlan) throws SQLException {
        persistTraversal(conn, null, traversal, traversalPlan);
    }

    public void persistTraversal(
            Connection conn,
            DungeonLayout previousLayout,
            Traversal traversal,
            TraversalPlan traversalPlan
    ) throws SQLException {
        if (traversal == null || traversal.traversalId() == null) {
            return;
        }
        if (!traversal.isPersistable()) {
            traversalWriteRepository.deleteTraversal(conn, traversal.traversalId());
            return;
        }
        traversalWriteRepository.replaceTraversalRooms(conn, traversal.traversalId(), traversal.roomIds());
        traversalWriteRepository.replaceTraversalWaypoints(conn, traversal.traversalId(), traversal.bindings().waypoints());
        traversalWriteRepository.replaceTraversalDoorBindings(conn, traversal.traversalId(), traversal.bindings().doorBindings());
        TraversalSegmentIds existingIds = segmentIds(previousLayout, traversal.traversalId());
        TraversalPlan resolvedPlan = TraversalReadModelProjector.preserveSegmentIds(traversal, traversalPlan, existingIds, previousLayout);
        reconcileCorridorSegments(conn, traversal, resolvedPlan, existingIds);
        reconcileStairSegments(conn, traversal, resolvedPlan, existingIds);
    }

    public void persistTraversals(Connection conn, Map<Long, Traversal> traversalsById) throws SQLException {
        persistTraversals(conn, null, traversalsById, Map.of());
    }

    public void persistTraversals(
            Connection conn,
            Map<Long, Traversal> traversalsById,
            Map<Long, TraversalPlan> traversalPlansByTraversalId
    ) throws SQLException {
        persistTraversals(conn, null, traversalsById, traversalPlansByTraversalId);
    }

    public void persistTraversals(
            Connection conn,
            DungeonLayout previousLayout,
            Map<Long, Traversal> traversalsById,
            Map<Long, TraversalPlan> traversalPlansByTraversalId
    ) throws SQLException {
        if (traversalsById == null || traversalsById.isEmpty()) {
            return;
        }
        for (Traversal traversal : traversalsById.values()) {
            TraversalPlan traversalPlan = traversal == null || traversal.traversalId() == null
                    ? TraversalPlan.empty()
                    : traversalPlansByTraversalId.getOrDefault(traversal.traversalId(), TraversalPlan.empty());
            persistTraversal(conn, previousLayout, traversal, traversalPlan);
        }
    }

    private void reconcileCorridorSegments(
            Connection conn,
            Traversal traversal,
            TraversalPlan traversalPlan,
            TraversalSegmentIds existingIds
    ) throws SQLException {
        Map<Long, String> existingById = existingCorridorIds(existingIds);
        Set<Long> desiredIds = new LinkedHashSet<>();
        for (var corridorSlice : traversalPlan.corridorSlices()) {
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
            } else {
                desiredIds.add(corridorId);
                corridorWriteRepository.updateTraversalCorridorSegmentKey(conn, corridorId, corridorSlice.segmentKey());
            }
        }
        for (Long corridorId : existingById.keySet()) {
            if (corridorId != null && !desiredIds.contains(corridorId)) {
                corridorWriteRepository.deleteCorridor(conn, corridorId);
            }
        }
    }

    private void reconcileStairSegments(
            Connection conn,
            Traversal traversal,
            TraversalPlan traversalPlan,
            TraversalSegmentIds existingIds
    ) throws SQLException {
        Map<Long, String> existingById = existingStairIds(existingIds);
        Set<Long> desiredIds = new LinkedHashSet<>();
        for (TraversalStairSlice stairSlice : traversalPlan.stairSlices()) {
            if (stairSlice == null || stairSlice.placement() == null) {
                continue;
            }
            DungeonStair materialized = stairSlice.placement().materialize(
                    stairSlice.stairId(),
                    traversal.traversalId(),
                    traversal.mapId());
            if (materialized == null) {
                continue;
            }
            long stairId;
            if (stairSlice.stairId() == null || !existingById.containsKey(stairSlice.stairId())) {
                stairId = stairWriteRepository.insertStair(
                        conn,
                        traversal.mapId(),
                        traversal.traversalId(),
                        stairSlice.segmentKey());
            } else {
                stairId = stairSlice.stairId();
                desiredIds.add(stairId);
                stairWriteRepository.updateTraversalStair(
                        conn,
                        stairId,
                        stairSlice.segmentKey());
            }
            stairWriteRepository.replacePathNodes(conn, stairId, materialized.path());
            stairWriteRepository.replaceExits(conn, stairId, materialized.exits());
        }
        for (Long stairId : existingById.keySet()) {
            if (stairId != null && !desiredIds.contains(stairId)) {
                stairWriteRepository.deleteStair(conn, stairId);
            }
        }
    }

    private static TraversalSegmentIds segmentIds(DungeonLayout previousLayout, Long traversalId) {
        if (previousLayout == null || traversalId == null) {
            return TraversalSegmentIds.empty();
        }
        TraversalSegmentIds existingIds = previousLayout.traversalSegmentIds(traversalId);
        if (!existingIds.corridorIdsBySegmentKey().isEmpty() || !existingIds.stairIdsBySegmentKey().isEmpty()) {
            return existingIds;
        }
        LinkedHashMap<String, Long> corridorIds = new LinkedHashMap<>();
        for (var corridor : previousLayout.corridors()) {
            if (corridor != null && Objects.equals(corridor.traversalId(), traversalId)) {
                corridorIds.put(corridor.segmentKey(), corridor.corridorId());
            }
        }
        return new TraversalSegmentIds(corridorIds, Map.of());
    }

    private static Map<Long, String> existingCorridorIds(TraversalSegmentIds existingIds) {
        LinkedHashMap<Long, String> result = new LinkedHashMap<>();
        for (Map.Entry<String, Long> entry : existingIds.corridorIdsBySegmentKey().entrySet()) {
            if (entry.getValue() != null) {
                result.put(entry.getValue(), entry.getKey());
            }
        }
        return result;
    }

    private static Map<Long, String> existingStairIds(TraversalSegmentIds existingIds) {
        LinkedHashMap<Long, String> result = new LinkedHashMap<>();
        for (Map.Entry<String, Long> entry : existingIds.stairIdsBySegmentKey().entrySet()) {
            if (entry.getValue() != null) {
                result.put(entry.getValue(), entry.getKey());
            }
        }
        return result;
    }
}
