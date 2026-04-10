package features.world.dungeon.dungeonmap.repository;

import database.DatabaseManager;
import features.world.dungeon.dungeonmap.state.PersistClusterRewriteRoomsState;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Canonical map-owned room rewrite persistence boundary. This repository owns the transaction and rewrites only the
 * room tables needed to finish one persisted cluster rewrite room tail.
 */
@SuppressWarnings("unused")
public final class PersistClusterRewriteRoomsRepository {

    private PersistClusterRewriteRoomsRepository() {
    }

    public static PersistClusterRewriteRoomsState persistClusterRewriteRooms(
            PersistClusterRewriteRoomsState state
    ) throws SQLException {
        PersistClusterRewriteRoomsState resolvedState = PersistClusterRewriteRoomsState.persistClusterRewriteRooms(state);
        if (resolvedState.rewrittenClusters().isEmpty() && resolvedState.removedRoomIds().isEmpty()) {
            return resolvedState;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
                return persistClusterRewriteRooms(conn, resolvedState);
            });
        }
    }

    public static PersistClusterRewriteRoomsState persistClusterRewriteRooms(
            Connection conn,
            PersistClusterRewriteRoomsState state
    ) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn");
        }
        PersistClusterRewriteRoomsState resolvedState = PersistClusterRewriteRoomsState.persistClusterRewriteRooms(state);
        if (resolvedState.rewrittenClusters().isEmpty() && resolvedState.removedRoomIds().isEmpty()) {
            return resolvedState;
        }
        deleteRooms(conn, resolvedState.removedRoomIds());
        List<PersistClusterRewriteRoomsState.ClusterState> persistedClusters = new ArrayList<>();
        for (PersistClusterRewriteRoomsState.ClusterState cluster : resolvedState.rewrittenClusters()) {
            persistedClusters.add(persistCluster(conn, resolvedState.mapId(), cluster));
        }
        return new PersistClusterRewriteRoomsState(
                resolvedState.mapId(),
                persistedClusters,
                resolvedState.removedRoomIds());
    }

    private static PersistClusterRewriteRoomsState.ClusterState persistCluster(
            Connection conn,
            long mapId,
            PersistClusterRewriteRoomsState.ClusterState cluster
    ) throws SQLException {
        ArrayList<PersistClusterRewriteRoomsState.RoomState> persistedRooms = new ArrayList<>();
        for (PersistClusterRewriteRoomsState.RoomState room : cluster.rooms()) {
            persistedRooms.add(persistRoom(conn, mapId, cluster.clusterId(), room));
        }
        return new PersistClusterRewriteRoomsState.ClusterState(cluster.clusterId(), persistedRooms);
    }

    private static PersistClusterRewriteRoomsState.RoomState persistRoom(
            Connection conn,
            long mapId,
            long clusterId,
            PersistClusterRewriteRoomsState.RoomState room
    ) throws SQLException {
        Long persistedRoomId = room.roomId();
        if (persistedRoomId == null) {
            persistedRoomId = insertRoom(conn, mapId, clusterId, room);
        } else {
            updateRoom(conn, persistedRoomId, clusterId, room);
        }
        replaceRoomLevels(conn, persistedRoomId, room.levelAnchors());
        replaceRoomNarration(conn, persistedRoomId, room);
        return new PersistClusterRewriteRoomsState.RoomState(
                persistedRoomId,
                room.name(),
                room.levelAnchors(),
                room.visualDescription(),
                room.exitNarrations());
    }

    private static void deleteRooms(Connection conn, List<Long> roomIds) throws SQLException {
        if (roomIds.isEmpty()) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM dungeon_rooms WHERE room_id=?")) {
            for (Long roomId : roomIds) {
                ps.setLong(1, roomId);
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private static long insertRoom(
            Connection conn,
            long mapId,
            long clusterId,
            PersistClusterRewriteRoomsState.RoomState room
    ) throws SQLException {
        PersistClusterRewriteRoomsState.LevelAnchorState primaryAnchor = primaryAnchor(room.levelAnchors());
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, component_x, component_y, level_z, visual_description)"
                        + " VALUES(?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, clusterId);
            ps.setString(3, room.name());
            ps.setInt(4, primaryAnchor.anchorX2() / 2);
            ps.setInt(5, primaryAnchor.anchorY2() / 2);
            ps.setInt(6, primaryAnchor.levelZ());
            ps.setString(7, room.visualDescription());
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_rooms insert");
                }
                return rs.getLong(1);
            }
        }
    }

    private static void updateRoom(
            Connection conn,
            long roomId,
            long clusterId,
            PersistClusterRewriteRoomsState.RoomState room
    ) throws SQLException {
        PersistClusterRewriteRoomsState.LevelAnchorState primaryAnchor = primaryAnchor(room.levelAnchors());
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms"
                        + " SET cluster_id=?, name=?, component_x=?, component_y=?, level_z=?, visual_description=?"
                        + " WHERE room_id=?")) {
            ps.setLong(1, clusterId);
            ps.setString(2, room.name());
            ps.setInt(3, primaryAnchor.anchorX2() / 2);
            ps.setInt(4, primaryAnchor.anchorY2() / 2);
            ps.setInt(5, primaryAnchor.levelZ());
            ps.setString(6, room.visualDescription());
            ps.setLong(7, roomId);
            ps.executeUpdate();
        }
    }

    private static void replaceRoomLevels(
            Connection conn,
            long roomId,
            List<PersistClusterRewriteRoomsState.LevelAnchorState> anchors
    ) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_levels WHERE room_id=?")) {
            delete.setLong(1, roomId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_levels(room_id, level_z, anchor_x2, anchor_y2) VALUES(?,?,?,?)")) {
            for (PersistClusterRewriteRoomsState.LevelAnchorState anchor : anchors) {
                insert.setLong(1, roomId);
                insert.setInt(2, anchor.levelZ());
                insert.setInt(3, anchor.anchorX2());
                insert.setInt(4, anchor.anchorY2());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceRoomNarration(
            Connection conn,
            long roomId,
            PersistClusterRewriteRoomsState.RoomState room
    ) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_exit_descriptions WHERE room_id=?")) {
            delete.setLong(1, roomId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_exit_descriptions(room_id, level_z, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            for (int index = 0; index < room.exitNarrations().size(); index++) {
                PersistClusterRewriteRoomsState.ExitNarrationState exitNarration = room.exitNarrations().get(index);
                insert.setLong(1, roomId);
                insert.setInt(2, exitNarration.levelZ());
                insert.setInt(3, exitNarration.roomCellX());
                insert.setInt(4, exitNarration.roomCellY());
                insert.setString(5, exitNarration.direction());
                insert.setString(6, exitNarration.description());
                insert.setInt(7, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static PersistClusterRewriteRoomsState.LevelAnchorState primaryAnchor(
            List<PersistClusterRewriteRoomsState.LevelAnchorState> anchors
    ) {
        PersistClusterRewriteRoomsState.LevelAnchorState primaryAnchor = anchors.get(0);
        for (PersistClusterRewriteRoomsState.LevelAnchorState anchor : anchors) {
            if (anchor.levelZ() < primaryAnchor.levelZ()) {
                primaryAnchor = anchor;
            }
        }
        return primaryAnchor;
    }
}
