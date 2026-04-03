package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonRoomTopologyService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonRoomRepository roomRepository;

    public DungeonRoomTopologyService(
            DungeonLayoutRepository layoutRepository,
            DungeonRoomRepository roomRepository
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.roomRepository = Objects.requireNonNull(roomRepository, "roomRepository");
    }

    public void paintCells(long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                paintCells(conn, mapId, levelZ, cells);
                return null;
            });
        }
    }

    public void deleteCells(long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                deleteCells(conn, mapId, levelZ, cells);
                return null;
            });
        }
    }

    public void editBoundary(
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        if (segments2x == null || segments2x.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editBoundary(conn, mapId, clusterId, levelZ, segments2x, type, deleteBoundary);
                return null;
            });
        }
    }

    public void paintCells(Connection conn, long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        List<RoomCluster> overlappingClusters = overlappingClustersAtLevel(layout, cells, levelZ).stream()
                .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                .toList();
        if (overlappingClusters.isEmpty()) {
            roomRepository.createClusterWithRoom(conn, mapId, levelZ, cells, nextRoomName(layout, new LinkedHashSet<>()));
            return;
        }

        ClusterRewrite rewrite = overlappingClusters.getFirst().applyPaint(cells, overlappingClusters, levelZ);
        if (rewrite.isNoOp()) {
            return;
        }

        roomRepository.saveClusterRewrite(conn, mapId, rewrite, levelZ);
    }

    public void deleteCells(Connection conn, long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        DungeonLayout workingLayout = requireLayout(conn, mapId);
        Set<String> reservedNames = new LinkedHashSet<>();
        for (Room room : workingLayout.rooms()) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                reservedNames.add(room.name());
            }
        }

        List<Long> affectedClusterIds = overlappingClustersAtLevel(workingLayout, cells, levelZ).stream()
                .map(RoomCluster::clusterId)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        for (Long clusterId : affectedClusterIds) {
            RoomCluster cluster = workingLayout.findCluster(clusterId);
            if (cluster == null) {
                continue;
            }
            DungeonLayout layoutSnapshot = workingLayout;
            ClusterRewrite rewrite = cluster.applyDelete(cells, () -> nextRoomName(layoutSnapshot, reservedNames), levelZ);
            if (rewrite.isNoOp()) {
                continue;
            }
            ClusterRewrite persistedRewrite = roomRepository.saveClusterRewrite(
                    conn,
                    mapId,
                    rewrite,
                    workingLayout.levelForCluster(rewrite.targetClusterId()));
            workingLayout = workingLayout.applying(persistedRewrite);
        }
    }

    public void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        roomRepository.createClusterWithRoom(conn, mapId, 0, Set.of(new CellCoord(0, 0)), "Eingang");
    }

    public void ensureTraversableCell(Connection conn, long mapId, CellCoord cell, int levelZ) throws SQLException {
        if (cell == null) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        if (layout.isTraversableCell(cell, levelZ)) {
            return;
        }
        paintCells(conn, mapId, levelZ, Set.of(cell));
    }

    public void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            GridSegment2x segment2x,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        editBoundary(conn, mapId, clusterId, levelZ, segment2x == null ? List.<GridSegment2x>of() : List.of(segment2x), type, deleteBoundary);
    }

    public void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        if (segments2x == null || segments2x.isEmpty()) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        ClusterRewrite rewrite = cluster.editBoundary(segments2x, type, deleteBoundary);
        if (rewrite == null) {
            return;
        }

        roomRepository.saveClusterRewrite(conn, mapId, rewrite, layout.levelForCluster(rewrite.targetClusterId()));
    }

    private static List<RoomCluster> overlappingClustersAtLevel(DungeonLayout layout, Set<CellCoord> cells, int levelZ) {
        return layout.overlappingClusters(cells).stream()
                .filter(cluster -> cluster != null && cluster.rooms().stream()
                        .anyMatch(room -> room != null
                                && room.structure().levels().contains(levelZ)))
                .toList();
    }

    private static String nextRoomName(DungeonLayout layout, Set<String> reservedNames) {
        Set<String> used = new LinkedHashSet<>(reservedNames);
        for (Room room : layout.rooms()) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                used.add(room.name());
            }
        }
        int next = 1;
        while (used.contains("Raum " + next)) {
            next++;
        }
        String result = "Raum " + next;
        used.add(result);
        reservedNames.add(result);
        return result;
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = layoutRepository.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }
}
