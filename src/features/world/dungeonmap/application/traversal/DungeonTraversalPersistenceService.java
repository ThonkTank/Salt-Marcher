package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.structures.stair.StairGeometry;
import features.world.dungeonmap.model.structures.traversal.TraversalCorridorSegment;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.TraversalReadModelProjector;
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
        TraversalPlan resolvedPlan = TraversalReadModelProjector.preserveSegmentIds(traversal, traversalPlan, previousLayout);
        reconcileCorridorSegments(conn, traversal, resolvedPlan);
        reconcileStairSegments(conn, traversal, resolvedPlan);
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

    private void reconcileCorridorSegments(Connection conn, Traversal traversal, TraversalPlan traversalPlan) throws SQLException {
        Map<Long, TraversalCorridorSegment> existingById = new LinkedHashMap<>();
        for (TraversalCorridorSegment corridorSegment : traversal.corridorSegments()) {
            if (corridorSegment != null && corridorSegment.corridorId() != null) {
                existingById.put(corridorSegment.corridorId(), corridorSegment);
            }
        }
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
        for (TraversalCorridorSegment corridorSegment : traversal.corridorSegments()) {
            if (corridorSegment != null
                    && corridorSegment.corridorId() != null
                    && !desiredIds.contains(corridorSegment.corridorId())) {
                corridorWriteRepository.deleteCorridor(conn, corridorSegment.corridorId());
            }
        }
    }

    private void reconcileStairSegments(Connection conn, Traversal traversal, TraversalPlan traversalPlan) throws SQLException {
        Map<Long, TraversalStairSegment> existingById = new LinkedHashMap<>();
        for (TraversalStairSegment stairSegment : traversal.stairSegments()) {
            if (stairSegment != null && stairSegment.stairId() != null) {
                existingById.put(stairSegment.stairId(), stairSegment);
            }
        }
        Set<Long> desiredIds = new LinkedHashSet<>();
        for (TraversalStairSlice stairSlice : traversalPlan.stairSlices()) {
            if (stairSlice == null || stairSlice.placement() == null) {
                continue;
            }
            StairGeometry geometry = StairGeometry.fromExitLevels(
                    stairSlice.placement().shape(),
                    stairSlice.placement().anchor(),
                    stairSlice.placement().direction() == null
                            ? CardinalDirection.defaultDirection()
                            : stairSlice.placement().direction(),
                    stairSlice.placement().dimension1(),
                    stairSlice.placement().dimension2(),
                    stairSlice.placement().exitLevels());
            long stairId;
            if (stairSlice.stairId() == null || !existingById.containsKey(stairSlice.stairId())) {
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
                stairId = stairSlice.stairId();
                desiredIds.add(stairId);
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
                    && !desiredIds.contains(stairSegment.stairId())) {
                stairWriteRepository.deleteStair(conn, stairSegment.stairId());
            }
        }
    }
}
