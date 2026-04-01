package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Objects;

public final class DungeonBoundaryEditService {

    private final DungeonRoomTopologyService topologyService;

    public DungeonBoundaryEditService(DungeonRoomTopologyService topologyService) {
        this.topologyService = Objects.requireNonNull(topologyService, "topologyService");
    }

    public void apply(
            long mapId,
            Long clusterId,
            int levelZ,
            GridSegment2x segment2x,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        apply(mapId, clusterId, levelZ, segment2x == null ? java.util.List.<GridSegment2x>of() : java.util.List.of(segment2x), type, deleteBoundary);
    }

    public void apply(
            long mapId,
            Long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        if (mapId <= 0 || clusterId == null || segments2x == null || segments2x.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                topologyService.editBoundary(conn, mapId, clusterId, levelZ, segments2x, type, deleteBoundary);
                return null;
            });
        }
    }
}
