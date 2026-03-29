package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.persistence.DungeonTraversalWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import java.util.Objects;

public final class DungeonTraversalPersistenceService {

    private final DungeonTraversalWriteRepository traversalWriteRepository;
    private final DungeonTraversalSegmentPersistence segmentPersistence;

    public DungeonTraversalPersistenceService(
            DungeonTraversalWriteRepository traversalWriteRepository,
            DungeonTraversalSegmentPersistence segmentPersistence
    ) {
        this.traversalWriteRepository = Objects.requireNonNull(traversalWriteRepository, "traversalWriteRepository");
        this.segmentPersistence = Objects.requireNonNull(segmentPersistence, "segmentPersistence");
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
            deleteTraversal(conn, traversal.traversalId());
            return;
        }
        traversalWriteRepository.replaceTraversalRooms(conn, traversal.traversalId(), traversal.roomIds());
        traversalWriteRepository.replaceTraversalWaypoints(conn, traversal.traversalId(), traversal.bindings().waypoints());
        traversalWriteRepository.replaceTraversalDoorBindings(conn, traversal.traversalId(), traversal.bindings().doorBindings());
        segmentPersistence.persistSegments(conn, previousLayout, traversal, traversalPlan);
    }

    public void deleteTraversal(Connection conn, long traversalId) throws SQLException {
        segmentPersistence.deleteSegmentsForTraversal(conn, traversalId);
        traversalWriteRepository.deleteTraversal(conn, traversalId);
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
}
