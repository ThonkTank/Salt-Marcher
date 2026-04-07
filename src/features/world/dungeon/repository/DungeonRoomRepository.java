package features.world.dungeon.repository;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.room.RoomExitNarration;
import features.world.dungeon.model.structures.room.RoomNarration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonRoomRepository {

    public List<Room> loadRooms(Connection conn, long mapId) throws SQLException {
        Map<Long, Map<Integer, GridPoint>> anchorsByRoomId = loadRoomAnchors(conn, mapId);
        Map<Long, List<RoomExitNarration>> exitNarrationsByRoomId = loadGrouped(
                conn,
                "SELECT room_id, level_z, cell_x, cell_y, edge_direction, description"
                        + " FROM dungeon_room_exit_descriptions"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z, sort_order, cell_y, cell_x, edge_direction",
                mapId,
                rs -> rs.getLong("room_id"),
                rs -> new RoomExitNarration(
                        rs.getInt("level_z"),
                        GridPoint.cell(rs.getInt("cell_x"), rs.getInt("cell_y"), 0),
                        DungeonPersistenceDirections.fromPersistedEdgeDirection(rs.getString("edge_direction")),
                        rs.getString("description")));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description"
                        + " FROM dungeon_rooms WHERE dungeon_map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Room> rooms = new ArrayList<>();
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    Map<Integer, GridPoint> anchorsByLevel = anchorsByRoomId.get(roomId);
                    if (anchorsByLevel == null || anchorsByLevel.isEmpty()) {
                        throw new IllegalStateException("Raum " + roomId + " hat keine persistierten Level-Anker");
                    }
                    rooms.add(Room.metadata(
                            roomId,
                            rs.getLong("dungeon_map_id"),
                            rs.getLong("cluster_id"),
                            normalizedRoomName(roomId, rs.getString("name")),
                            anchorsByLevel,
                            new RoomNarration(
                                    rs.getString("visual_description"),
                                    exitNarrationsByRoomId.getOrDefault(roomId, List.of()))));
                }
                return rooms.isEmpty() ? List.of() : List.copyOf(rooms);
            }
        }
    }

    public void saveRooms(Connection conn, long mapId, long clusterId, List<Room> rooms) throws SQLException {
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            if (room.roomId() == null) {
                insertRoom(conn, mapId, clusterId, room.name(), room.anchorsByLevel());
                continue;
            }
            reassignRoomCluster(conn, room.roomId(), clusterId);
            updateRoom(conn, room.roomId(), room.name(), room.anchorsByLevel());
        }
    }

    public void deleteRooms(Connection conn, Collection<Long> roomIds) throws SQLException {
        if (conn == null || roomIds == null || roomIds.isEmpty()) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            for (Long roomId : roomIds) {
                if (roomId == null || roomId <= 0L) {
                    continue;
                }
                ps.setLong(1, roomId);
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public void replaceRoomNarration(Connection conn, long roomId, RoomNarration narration) throws SQLException {
        RoomNarration resolvedNarration = narration == null ? RoomNarration.empty() : narration;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET visual_description=? WHERE room_id=?")) {
            ps.setString(1, resolvedNarration.visualDescription());
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_exit_descriptions WHERE room_id=?")) {
            delete.setLong(1, roomId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_exit_descriptions(room_id, level_z, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (RoomExitNarration exitNarration : resolvedNarration.exitNarrations()) {
                insert.setLong(1, roomId);
                insert.setInt(2, exitNarration.levelZ());
                insert.setInt(3, exitNarration.roomCell().cellX());
                insert.setInt(4, exitNarration.roomCell().cellY());
                insert.setString(5, DungeonPersistenceDirections.toPersistedEdgeDirection(exitNarration.direction()));
                insert.setString(6, exitNarration.description());
                insert.setInt(7, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private void reassignRoomCluster(Connection conn, long roomId, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET cluster_id=? WHERE room_id=?")) {
            ps.setLong(1, clusterId);
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    private long insertRoom(
            Connection conn,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, GridPoint> anchorsByLevel
    ) throws SQLException {
        Map<Integer, GridPoint> resolvedAnchors = requiredAnchors(anchorsByLevel);
        int primaryLevel = primaryLevel(resolvedAnchors);
        GridPoint primaryAnchor = primaryAnchorCell(resolvedAnchors);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, component_x, component_y, level_z) VALUES(?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, clusterId);
            ps.setString(3, name);
            ps.setInt(4, primaryAnchor.cellX());
            ps.setInt(5, primaryAnchor.cellY());
            ps.setInt(6, primaryLevel);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_rooms insert");
                }
                long roomId = rs.getLong(1);
                replaceRoomAnchors(conn, roomId, resolvedAnchors);
                return roomId;
            }
        }
    }

    private void updateRoom(
            Connection conn,
            long roomId,
            String name,
            Map<Integer, GridPoint> anchorsByLevel
    ) throws SQLException {
        Map<Integer, GridPoint> resolvedAnchors = requiredAnchors(anchorsByLevel);
        int primaryLevel = primaryLevel(resolvedAnchors);
        GridPoint primaryAnchor = primaryAnchorCell(resolvedAnchors);
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, component_x=?, component_y=?, level_z=? WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, primaryAnchor.cellX());
            ps.setInt(3, primaryAnchor.cellY());
            ps.setInt(4, primaryLevel);
            ps.setLong(5, roomId);
            ps.executeUpdate();
        }
        replaceRoomAnchors(conn, roomId, resolvedAnchors);
    }

    private void replaceRoomAnchors(Connection conn, long roomId, Map<Integer, GridPoint> anchorsByLevel) throws SQLException {
        Map<Integer, GridPoint> resolvedAnchors = requiredAnchors(anchorsByLevel);
        try (PreparedStatement deleteLevels = conn.prepareStatement(
                "DELETE FROM dungeon_room_levels WHERE room_id=?")) {
            deleteLevels.setLong(1, roomId);
            deleteLevels.executeUpdate();
        }
        try (PreparedStatement insertLevel = conn.prepareStatement(
                "INSERT INTO dungeon_room_levels(room_id, level_z, anchor_x2, anchor_y2) VALUES(?,?,?,?)")) {
            for (var entry : resolvedAnchors.entrySet()) {
                insertLevel.setLong(1, roomId);
                insertLevel.setInt(2, entry.getKey());
                insertLevel.setInt(3, persistedCellX2(entry.getValue()));
                insertLevel.setInt(4, persistedCellY2(entry.getValue()));
                insertLevel.addBatch();
            }
            insertLevel.executeBatch();
        }
    }

    private static Map<Integer, GridPoint> requiredAnchors(Map<Integer, GridPoint> anchorsByLevel) {
        if (anchorsByLevel == null || anchorsByLevel.isEmpty()) {
            throw new IllegalArgumentException("Room anchors must not be empty");
        }
        Map<Integer, GridPoint> result = new LinkedHashMap<>();
        anchorsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Room anchors must not be empty");
        }
        return Map.copyOf(result);
    }

    private static int primaryLevel(Map<Integer, GridPoint> anchorsByLevel) {
        return anchorsByLevel.keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    private static GridPoint primaryAnchorCell(Map<Integer, GridPoint> anchorsByLevel) {
        return anchorsByLevel.getOrDefault(primaryLevel(anchorsByLevel), GridPoint.cell(0, 0, 0));
    }

    private static int persistedCellX2(GridPoint cell) {
        GridPoint resolvedCell = cell == null ? GridPoint.cell(0, 0, 0) : cell;
        return resolvedCell.x2();
    }

    private static int persistedCellY2(GridPoint cell) {
        GridPoint resolvedCell = cell == null ? GridPoint.cell(0, 0, 0) : cell;
        return resolvedCell.y2();
    }

    private static Map<Long, Map<Integer, GridPoint>> loadRoomAnchors(Connection conn, long mapId) throws SQLException {
        Map<Long, Map<Integer, GridPoint>> anchorsByRoomId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, level_z, anchor_x2, anchor_y2"
                        + " FROM dungeon_room_levels"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    anchorsByRoomId.computeIfAbsent(rs.getLong("room_id"), ignored -> new LinkedHashMap<>())
                            .put(rs.getInt("level_z"), requireStoredCellCenter(
                                    rs.getInt("anchor_x2"),
                                    rs.getInt("anchor_y2"),
                                    "room anchor",
                                    rs.getLong("room_id"),
                                    rs.getInt("level_z")));
                }
            }
        }
        Map<Long, Map<Integer, GridPoint>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<Integer, GridPoint>> entry : anchorsByRoomId.entrySet()) {
            result.put(entry.getKey(), Map.copyOf(entry.getValue()));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static GridPoint requireStoredCellCenter(int persistedX2, int persistedY2, String label, long roomId, int levelZ) {
        GridPoint point = GridPoint.lattice(persistedX2, persistedY2, 0);
        if (point.kind() != GridPoint.Kind.CELL) {
            throw new IllegalArgumentException(label + " must be a tile center for room " + roomId + " at level " + levelZ);
        }
        return point;
    }

    private static <K, V> Map<K, List<V>> loadGrouped(
            Connection conn,
            String sql,
            long mapId,
            ResultSetMapper<K> keyExtractor,
            ResultSetMapper<V> valueExtractor
    ) throws SQLException {
        Map<K, List<V>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    K key = keyExtractor.map(rs);
                    V value = valueExtractor.map(rs);
                    if (value != null) {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
                    } else {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>());
                    }
                }
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static String normalizedRoomName(long roomId, String name) {
        return name == null || name.isBlank() ? "Raum " + roomId : name.trim();
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }
}
