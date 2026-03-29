package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
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
        persistTraversal(conn, null, traversal, TraversalRoute.empty());
    }

    public void persistTraversal(Connection conn, Traversal traversal, TraversalRoute traversalRoute) throws SQLException {
        persistTraversal(conn, null, traversal, traversalRoute);
    }

    public void persistTraversal(
            Connection conn,
            DungeonLayout previousLayout,
            Traversal traversal,
            TraversalRoute traversalRoute
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
        segmentPersistence.persistSegments(conn, previousLayout, traversal, traversalRoute);
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
            Map<Long, TraversalRoute> traversalRoutesByTraversalId
    ) throws SQLException {
        persistTraversals(conn, null, traversalsById, traversalRoutesByTraversalId);
    }

    public void persistTraversals(
            Connection conn,
            DungeonLayout previousLayout,
            Map<Long, Traversal> traversalsById,
            Map<Long, TraversalRoute> traversalRoutesByTraversalId
    ) throws SQLException {
        if (traversalsById == null || traversalsById.isEmpty()) {
            return;
        }
        for (Traversal traversal : traversalsById.values()) {
            TraversalRoute traversalRoute = traversal == null || traversal.traversalId() == null
                    ? TraversalRoute.empty()
                    : traversalRoutesByTraversalId.getOrDefault(traversal.traversalId(), TraversalRoute.empty());
            persistTraversal(conn, previousLayout, traversal, traversalRoute);
        }
    }
}
