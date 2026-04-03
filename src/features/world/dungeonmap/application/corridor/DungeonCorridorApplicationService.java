package features.world.dungeonmap.application.corridor;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.repository.DungeonCorridorRepository;
import features.world.dungeonmap.repository.DungeonLayoutRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

public final class DungeonCorridorApplicationService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonCorridorRepository corridorRepository;

    public DungeonCorridorApplicationService(
            DungeonLayoutRepository layoutRepository,
            DungeonCorridorRepository corridorRepository
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.corridorRepository = Objects.requireNonNull(corridorRepository, "corridorRepository");
    }

    public long create(long mapId, int levelZ, List<CorridorNode> nodes, List<CorridorSegment> segments) throws SQLException {
        if (mapId <= 0 || nodes == null || segments == null) {
            throw new IllegalArgumentException("Corridor create requires map, nodes, and segments");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                Corridor corridor = layout.planCorridor(levelZ, nodes, segments);
                Corridor persisted = corridorRepository.save(conn, corridor, layout);
                if (persisted.corridorId() == null) {
                    throw new SQLException("No id returned for persisted corridor");
                }
                return persisted.corridorId();
            });
        }
    }

    public void branch(
            long mapId,
            long corridorId,
            long attachNodeId,
            List<CorridorNode> branchNodes,
            List<CorridorSegment> branchSegments
    ) throws SQLException {
        if (mapId <= 0 || corridorId <= 0 || attachNodeId <= 0 || branchNodes == null || branchSegments == null) {
            throw new IllegalArgumentException("Corridor branch requires map, corridor, attach node, branch nodes, and branch segments");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                Corridor corridor = requireCorridor(layout, corridorId);
                Corridor updated = corridor.branchedFrom(layout, attachNodeId, branchNodes, branchSegments);
                if (updated != corridor) {
                    corridorRepository.save(conn, updated, layout);
                }
            });
        }
    }

    public void insertNode(long mapId, long corridorId, long segmentId, GridPoint2x point2x) throws SQLException {
        if (mapId <= 0 || corridorId <= 0 || segmentId <= 0 || point2x == null) {
            throw new IllegalArgumentException("Corridor insert requires map, corridor, segment, and point");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                Corridor corridor = requireCorridor(layout, corridorId);
                Corridor updated = corridor.insertedNode(layout, segmentId, point2x);
                if (updated != corridor) {
                    corridorRepository.save(conn, updated, layout);
                }
            });
        }
    }

    public void moveNode(long mapId, long corridorId, long nodeId, GridPoint2x point2x) throws SQLException {
        if (mapId <= 0 || corridorId <= 0 || nodeId <= 0 || point2x == null) {
            throw new IllegalArgumentException("Corridor move requires map, corridor, node, and point");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                Corridor corridor = requireCorridor(layout, corridorId);
                Corridor updated = corridor.movedNode(layout, nodeId, point2x);
                if (updated != corridor) {
                    corridorRepository.save(conn, updated, layout);
                }
            });
        }
    }

    public void deleteNode(long mapId, long corridorId, long nodeId) throws SQLException {
        if (mapId <= 0 || corridorId <= 0 || nodeId <= 0) {
            throw new IllegalArgumentException("Corridor node delete requires map, corridor, and node");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                Corridor corridor = requireCorridor(layout, corridorId);
                Corridor updated = corridor.deletedNode(layout, nodeId);
                if (updated != corridor) {
                    corridorRepository.save(conn, updated, layout);
                }
            });
        }
    }

    public void delete(long mapId, long corridorId) throws SQLException {
        if (mapId <= 0 || corridorId <= 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                if (layout.findCorridor(corridorId) == null) {
                    return;
                }
                corridorRepository.deleteCorridor(conn, corridorId);
            });
        }
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = layoutRepository.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private static Corridor requireCorridor(DungeonLayout layout, long corridorId) throws SQLException {
        Corridor corridor = layout == null ? null : layout.findCorridor(corridorId);
        if (corridor == null) {
            throw new SQLException("Corridor " + corridorId + " existiert nicht");
        }
        return corridor;
    }
}
