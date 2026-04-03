package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.cluster.ClusterRewriteSplit;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;
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
import java.util.function.Supplier;

/**
 * Central room/cluster workflow owner for editor-visible room mutations.
 *
 * <p>Paint, delete, boundary edits, cluster moves, narration writes, and traversability bootstrap all converge
 * here so tools and neighboring application flows do not keep parallel room workflow owners alive.
 */
public final class DungeonRoomApplicationService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonRoomRepository roomRepository;

    public DungeonRoomApplicationService(
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

    public void createDoor(long mapId, long clusterId, int levelZ, Collection<GridSegment2x> segments2x) throws SQLException {
        editDoor(mapId, clusterId, levelZ, segments2x, false);
    }

    public void deleteDoor(long mapId, long clusterId, int levelZ, Collection<GridSegment2x> segments2x) throws SQLException {
        editDoor(mapId, clusterId, levelZ, segments2x, true);
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
            ClusterRewrite rewrite = assignGeneratedRoomNames(
                    cluster.applyDelete(cells, levelZ),
                    () -> nextRoomName(layoutSnapshot, reservedNames));
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
        DungeonLayout layout = requireLayout(conn, mapId);
        roomRepository.createClusterWithRoom(
                conn,
                mapId,
                0,
                Set.of(new CellCoord(0, 0)),
                nextRoomName(layout, new LinkedHashSet<>()));
    }

    public void move(long mapId, long clusterId, CellCoord delta, int levelDelta) throws SQLException {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                DungeonLayout movedLayout = layout.withMovedCluster(clusterId, delta, levelDelta);
                RoomCluster cluster = requireCluster(movedLayout, clusterId);
                roomRepository.saveMovedCluster(conn, cluster);
                persistUpdatedCorridors(conn, layout, movedLayout);
                return null;
            });
        }
    }

    public void saveNarration(long roomId, RoomNarration narration) throws SQLException {
        if (roomId <= 0) {
            throw new SQLException("Raum fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn,
                    () -> roomRepository.replaceRoomNarration(conn, roomId, narration));
        }
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

    private void editDoor(
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            boolean deleteDoor
    ) throws SQLException {
        if (segments2x == null || segments2x.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editDoor(conn, mapId, clusterId, levelZ, segments2x, deleteDoor);
                return null;
            });
        }
    }

    private void editDoor(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            boolean deleteDoor
    ) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        RoomCluster projectedCluster = cluster == null ? null : cluster.projectedToLevel(levelZ);
        if (projectedCluster == null) {
            return;
        }
        List<GridSegment2x> editableSegments = segments2x.stream()
                .filter(Objects::nonNull)
                .filter(segment2x -> deleteDoor
                        ? projectedCluster.canDeleteDoor(segment2x)
                        : projectedCluster.canCreateDoor(segment2x))
                .toList();
        if (editableSegments.isEmpty()) {
            return;
        }
        ClusterRewrite rewrite = cluster.editBoundary(editableSegments, InternalBoundaryType.DOOR, deleteDoor);
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

    private static RoomCluster requireCluster(DungeonLayout layout, long clusterId) throws SQLException {
        RoomCluster cluster = layout == null ? null : layout.findCluster(clusterId);
        if (cluster == null) {
            throw new SQLException("Cluster " + clusterId + " existiert nicht");
        }
        return cluster;
    }

    private void persistUpdatedCorridors(Connection conn, DungeonLayout originalLayout, DungeonLayout movedLayout) throws SQLException {
        if (conn == null || originalLayout == null || movedLayout == null) {
            return;
        }
        for (var originalCorridor : originalLayout.corridors()) {
            if (originalCorridor == null || originalCorridor.corridorId() == null) {
                continue;
            }
            var movedCorridor = movedLayout.findCorridor(originalCorridor.corridorId());
            if (movedCorridor != null && movedCorridor != originalCorridor) {
                new features.world.dungeonmap.repository.DungeonCorridorRepository().save(conn, movedCorridor, movedLayout);
            }
        }
    }

    private static ClusterRewrite assignGeneratedRoomNames(ClusterRewrite rewrite, Supplier<String> roomNameSupplier) {
        if (rewrite == null || roomNameSupplier == null) {
            return rewrite;
        }
        List<Room> renamedRooms = assignGeneratedRoomNames(rewrite.rooms(), roomNameSupplier);
        List<ClusterRewriteSplit> renamedSplits = rewrite.splitClusters().stream()
                .map(split -> new ClusterRewriteSplit(
                        split.clusterId(),
                        split.clusterCenter(),
                        assignGeneratedRoomNames(split.rooms(), roomNameSupplier)))
                .toList();
        if (renamedRooms.equals(rewrite.rooms()) && renamedSplits.equals(rewrite.splitClusters())) {
            return rewrite;
        }
        return ClusterRewrite.builder(rewrite.targetClusterId(), rewrite.clusterCenter(), renamedRooms)
                .deletedRoomIds(rewrite.deletedRoomIds())
                .deletedClusterIds(rewrite.deletedClusterIds())
                .splitClusters(renamedSplits)
                .topologyChanged(rewrite.topologyChanged())
                .build();
    }

    private static List<Room> assignGeneratedRoomNames(List<Room> rooms, Supplier<String> roomNameSupplier) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        boolean changed = false;
        List<Room> renamedRooms = new java.util.ArrayList<>(rooms.size());
        for (Room room : rooms) {
            if (room == null || room.roomId() != null || room.name() != null && !room.name().isBlank()) {
                renamedRooms.add(room);
                continue;
            }
            String generatedName = roomNameSupplier.get();
            Room renamedRoom = Room.resolved(
                    null,
                    room.mapId(),
                    room.clusterId(),
                    generatedName == null || generatedName.isBlank() ? "Raum neu" : generatedName.trim(),
                    room.structure(),
                    room.narration());
            renamedRooms.add(renamedRoom);
            changed = true;
        }
        return changed ? List.copyOf(renamedRooms) : rooms;
    }
}
