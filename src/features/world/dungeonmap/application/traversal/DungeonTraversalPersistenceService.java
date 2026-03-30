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
    private final DungeonTraversalStructureCommitter structureCommitter;

    public DungeonTraversalPersistenceService(
            DungeonTraversalWriteRepository traversalWriteRepository,
            DungeonTraversalStructureCommitter structureCommitter
    ) {
        this.traversalWriteRepository = Objects.requireNonNull(traversalWriteRepository, "traversalWriteRepository");
        this.structureCommitter = Objects.requireNonNull(structureCommitter, "structureCommitter");
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
        TraversalRoute routeToPersist = requireExplicitRoute(previousLayout, traversal, traversalRoute);
        traversalWriteRepository.replaceTraversalRooms(conn, traversal.traversalId(), traversal.roomIds());
        traversalWriteRepository.replaceTraversalWaypoints(conn, traversal.traversalId(), traversal.bindings().waypoints());
        traversalWriteRepository.replaceTraversalDoorBindings(conn, traversal.traversalId(), traversal.bindings().doorBindings());
        structureCommitter.persistStructures(conn, previousLayout, traversal, routeToPersist);
    }

    public void deleteTraversal(Connection conn, long traversalId) throws SQLException {
        structureCommitter.deleteStructuresForTraversal(conn, traversalId);
        traversalWriteRepository.deleteTraversal(conn, traversalId);
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
        Map<Long, TraversalRoute> requestedRoutesByTraversalId = traversalRoutesByTraversalId == null
                ? Map.of()
                : traversalRoutesByTraversalId;
        for (Traversal traversal : traversalsById.values()) {
            TraversalRoute traversalRoute = traversal == null || traversal.traversalId() == null
                    ? TraversalRoute.empty()
                    : requestedRoutesByTraversalId.get(traversal.traversalId());
            persistTraversal(conn, previousLayout, traversal, traversalRoute);
        }
    }

    private static TraversalRoute requireExplicitRoute(
            DungeonLayout previousLayout,
            Traversal traversal,
            TraversalRoute traversalRoute
    ) {
        if (requiresExplicitRoute(previousLayout, traversal) && traversalRoute == null) {
            throw new IllegalArgumentException(
                    "Traversal " + traversal.traversalId() + " requires an explicit route before persistence");
        }
        return traversalRoute == null ? TraversalRoute.empty() : traversalRoute;
    }

    private static boolean requiresExplicitRoute(DungeonLayout previousLayout, Traversal traversal) {
        return previousLayout != null
                && traversal != null
                && traversal.traversalId() != null
                && traversal.isPersistable();
    }
}
