package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.structures.stair.StairGeometry;
import features.world.dungeonmap.model.structures.traversal.TraversalCorridorSegment;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.TraversalStairSegment;
import features.world.dungeonmap.model.structures.traversal.TraversalStairSlice;
import features.world.dungeonmap.model.structures.traversal.Traversal;
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
        persistTraversal(conn, traversal, TraversalPlan.empty());
    }

    public void persistTraversal(Connection conn, Traversal traversal, TraversalPlan traversalPlan) throws SQLException {
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
        reconcileCorridorSegments(conn, traversal, traversalPlan);
        reconcileStairSegments(conn, traversal, traversalPlan);
    }

    public void persistTraversals(Connection conn, Map<Long, Traversal> traversalsById) throws SQLException {
        persistTraversals(conn, traversalsById, Map.of());
    }

    public void persistTraversals(
            Connection conn,
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
            persistTraversal(conn, traversal, traversalPlan);
        }
    }

    private void reconcileCorridorSegments(Connection conn, Traversal traversal, TraversalPlan traversalPlan) throws SQLException {
        Map<String, TraversalCorridorSegment> existingByKey = new LinkedHashMap<>();
        for (TraversalCorridorSegment corridorSegment : traversal.corridorSegments()) {
            if (corridorSegment != null) {
                existingByKey.put(corridorSegment.segmentKey(), corridorSegment);
            }
        }
        Set<String> desiredKeys = new LinkedHashSet<>();
        for (var corridorSlice : traversalPlan.corridorSlices()) {
            if (corridorSlice == null) {
                continue;
            }
            desiredKeys.add(corridorSlice.segmentKey());
            TraversalCorridorSegment existing = existingByKey.get(corridorSlice.segmentKey());
            if (existing == null || existing.corridorId() == null) {
                corridorWriteRepository.insertTraversalCorridor(
                        conn,
                        traversal.mapId(),
                        traversal.traversalId(),
                        corridorSlice.segmentKey());
            } else {
                corridorWriteRepository.updateTraversalCorridorSegmentKey(conn, existing.corridorId(), corridorSlice.segmentKey());
            }
        }
        for (TraversalCorridorSegment corridorSegment : traversal.corridorSegments()) {
            if (corridorSegment != null
                    && corridorSegment.corridorId() != null
                    && !desiredKeys.contains(corridorSegment.segmentKey())) {
                corridorWriteRepository.deleteCorridor(conn, corridorSegment.corridorId());
            }
        }
    }

    private void reconcileStairSegments(Connection conn, Traversal traversal, TraversalPlan traversalPlan) throws SQLException {
        Map<String, TraversalStairSegment> existingByKey = new LinkedHashMap<>();
        for (TraversalStairSegment stairSegment : traversal.stairSegments()) {
            if (stairSegment != null) {
                existingByKey.put(stairSegment.segmentKey(), stairSegment);
            }
        }
        Set<String> desiredKeys = new LinkedHashSet<>();
        for (TraversalStairSlice stairSlice : traversalPlan.stairSlices()) {
            if (stairSlice == null || stairSlice.placement() == null) {
                continue;
            }
            desiredKeys.add(stairSlice.segmentKey());
            StairGeometry geometry = StairGeometry.fromExitLevels(
                    stairSlice.placement().shape(),
                    stairSlice.placement().anchor(),
                    stairSlice.placement().direction() == null
                            ? CardinalDirection.defaultDirection()
                            : stairSlice.placement().direction(),
                    stairSlice.placement().dimension1(),
                    stairSlice.placement().dimension2(),
                    stairSlice.placement().exitLevels());
            TraversalStairSegment existing = existingByKey.get(stairSlice.segmentKey());
            long stairId;
            if (existing == null || existing.stairId() == null) {
                stairId = stairWriteRepository.insertStair(
                        conn,
                        traversal.mapId(),
                        traversal.traversalId(),
                        stairSlice.segmentKey(),
                        null,
                        stairSlice.placement().shape(),
                        stairSlice.placement().direction(),
                        stairSlice.placement().dimension1(),
                        stairSlice.placement().dimension2());
            } else {
                stairId = existing.stairId();
                stairWriteRepository.updateTraversalStair(
                        conn,
                        stairId,
                        stairSlice.segmentKey(),
                        null,
                        stairSlice.placement().shape(),
                        stairSlice.placement().direction(),
                        stairSlice.placement().dimension1(),
                        stairSlice.placement().dimension2());
            }
            stairWriteRepository.replacePathNodes(conn, stairId, geometry.pathNodes());
            stairWriteRepository.replaceExits(conn, stairId, geometry.exits());
        }
        for (TraversalStairSegment stairSegment : traversal.stairSegments()) {
            if (stairSegment != null
                    && stairSegment.stairId() != null
                    && !desiredKeys.contains(stairSegment.segmentKey())) {
                stairWriteRepository.deleteStair(conn, stairSegment.stairId());
            }
        }
    }
}
