package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonClusterMoveService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonRoomRepository roomRepository;
    private final DungeonClusterMoveProjectionApplicationService projectionApplicationService;

    public DungeonClusterMoveService(
            DungeonLayoutRepository layoutRepository,
            DungeonRoomRepository roomRepository,
            DungeonClusterMoveProjectionApplicationService projectionApplicationService
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.roomRepository = Objects.requireNonNull(roomRepository, "roomRepository");
        this.projectionApplicationService = Objects.requireNonNull(projectionApplicationService, "projectionApplicationService");
    }

    public void move(long mapId, long clusterId, CellCoord delta) throws SQLException {
        move(mapId, clusterId, delta, 0);
    }

    public void move(long mapId, long clusterId, CellCoord delta, int levelDelta) throws SQLException {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                DungeonClusterMoveProjection projection = projectionApplicationService.project(layout, clusterId, delta, levelDelta);
                RoomCluster cluster = requireCluster(projection.layout(), clusterId);
                roomRepository.updateClusterMetadata(
                        conn,
                        clusterId,
                        cluster.center(),
                        cluster.primaryLevel());
                for (Room room : cluster.rooms()) {
                    if (room == null || room.roomId() == null) {
                        continue;
                    }
                    roomRepository.updateRoom(conn, room.roomId(), room.name(), room.structure().descriptor());
                }
                return null;
            });
        }
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        var layout = layoutRepository.loadLayout(conn, mapId);
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
