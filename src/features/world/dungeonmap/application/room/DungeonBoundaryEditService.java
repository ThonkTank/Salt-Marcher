package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonBoundaryEditService {

    private final DungeonRoomTopologyService topologyService;

    public DungeonBoundaryEditService(DungeonRoomTopologyService topologyService) {
        this.topologyService = Objects.requireNonNull(topologyService, "topologyService");
    }

    public void apply(
            long mapId,
            Long clusterId,
            VertexEdge edge,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        if (mapId <= 0 || clusterId == null || edge == null) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                topologyService.editBoundary(conn, mapId, clusterId, edge, type, deleteBoundary);
                return null;
            });
        }
    }
}
