package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.application.traversal.DungeonTraversalPersistenceService;
import features.world.dungeonmap.model.DungeonClusterTranslation;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.TraversalPlanningInputProjector;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRewriteContext;
import features.world.dungeonmap.persistence.DungeonRoomGeometryWriteMapper;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Set;

public final class DungeonClusterMoveService {

    private final DungeonMapLoader mapLoader;
    private final DungeonRoomWriteRepository roomWriteRepository;
    private final DungeonRoomGeometryWriteMapper geometryWriteMapper;
    private final DungeonTraversalPersistenceService traversalPersistenceService;

    public DungeonClusterMoveService(
            DungeonMapLoader mapLoader,
            DungeonRoomWriteRepository roomWriteRepository,
            DungeonRoomGeometryWriteMapper geometryWriteMapper,
            DungeonTraversalPersistenceService traversalPersistenceService
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.roomWriteRepository = Objects.requireNonNull(roomWriteRepository, "roomWriteRepository");
        this.geometryWriteMapper = Objects.requireNonNull(geometryWriteMapper, "geometryWriteMapper");
        this.traversalPersistenceService = Objects.requireNonNull(traversalPersistenceService, "traversalPersistenceService");
    }

    public void move(long mapId, long clusterId, Point2i delta) throws SQLException {
        move(mapId, clusterId, delta, 0);
    }

    public void move(long mapId, long clusterId, Point2i delta, int levelDelta) throws SQLException {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                DungeonClusterTranslation translation = layout.translateCluster(clusterId, delta, levelDelta);
                RoomCluster cluster = requireCluster(translation.layout(), clusterId);
                roomWriteRepository.updateClusterGeometry(
                        conn,
                        clusterId,
                        geometryWriteMapper.toClusterGeometry(cluster.shapesByLevel()),
                        cluster.primaryLevel());
                for (Room room : cluster.rooms()) {
                    if (room == null || room.roomId() == null) {
                        continue;
                    }
                    roomWriteRepository.updateRoomPosition(conn, room.roomId(), room.anchorsByLevel(), room.primaryLevel());
                }
                Traversal.RewriteResult rewriteResult = Traversal.rewriteAll(
                        new java.util.LinkedHashMap<>(layout.traversalsById()),
                        new TraversalRewriteContext(
                                TraversalPlanningInputProjector.project(layout),
                                TraversalPlanningInputProjector.project(translation.layout()),
                                layout.traversalIdsAffectedBy(cluster.roomIds(), Set.of(clusterId)),
                                Set.of()));
                traversalPersistenceService.persistTraversals(conn, rewriteResult.traversalsById(), rewriteResult.traversalPlansByTraversalId());
                return null;
            });
        }
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        var layout = mapLoader.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private static RoomCluster requireCluster(DungeonLayout layout, long clusterId) throws SQLException {
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            throw new SQLException("Cluster " + clusterId + " existiert nicht");
        }
        return cluster;
    }
}
