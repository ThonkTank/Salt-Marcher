package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class DungeonMapRepository {

    private DungeonMapRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonMap> getAllMaps(Connection conn) throws SQLException {
        List<DungeonMap> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name, width, height FROM dungeon_maps ORDER BY dungeon_map_id");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                result.add(new DungeonMap(
                        rs.getLong("dungeon_map_id"),
                        rs.getString("name"),
                        rs.getInt("width"),
                        rs.getInt("height")));
            }
        }
        return result;
    }

    public static long insertMap(Connection conn, DungeonMap map) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_maps(name, width, height) VALUES(?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, map.name());
            ps.setInt(2, map.width());
            ps.setInt(3, map.height());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for dungeon_maps insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public static void updateMap(Connection conn, long mapId, String name, int width, int height) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_maps SET name=?, width=?, height=? WHERE dungeon_map_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, width);
            ps.setInt(3, height);
            ps.setLong(4, mapId);
            ps.executeUpdate();
        }
    }

    public static void deleteSquaresOutsideBounds(Connection conn, long mapId, int width, int height) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_squares WHERE map_id=? AND (x >= ? OR y >= ?)")) {
            ps.setLong(1, mapId);
            ps.setInt(2, width);
            ps.setInt(3, height);
            ps.executeUpdate();
        }
    }

    public static Optional<DungeonMap> findMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name, width, height FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(new DungeonMap(
                        rs.getLong("dungeon_map_id"),
                        rs.getString("name"),
                        rs.getInt("width"),
                        rs.getInt("height")));
            }
        }
    }

    public static List<DungeonSquare> getSquares(Connection conn, long mapId) throws SQLException {
        List<DungeonSquare> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT s.square_id, s.map_id, s.x, s.y, s.room_id, "
                        + "r.name AS room_name, r.area_id, a.name AS area_name "
                        + "FROM dungeon_squares s "
                        + "LEFT JOIN dungeon_rooms r ON r.room_id = s.room_id "
                        + "LEFT JOIN dungeon_areas a ON a.area_id = r.area_id "
                        + "WHERE s.map_id=? ORDER BY s.y, s.x")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(mapSquare(rs));
                }
            }
        }
        return result;
    }

    public static void applySquarePaints(Connection conn, long mapId, List<DungeonSquarePaint> paints) throws SQLException {
        try (PreparedStatement upsert = conn.prepareStatement(
                "INSERT INTO dungeon_squares(map_id, x, y, room_id) VALUES(?,?,?,?) "
                        + "ON CONFLICT(map_id, x, y) DO UPDATE SET room_id=excluded.room_id");
             PreparedStatement delete = conn.prepareStatement(
                     "DELETE FROM dungeon_squares WHERE map_id=? AND x=? AND y=?")) {
            for (DungeonSquarePaint paint : paints) {
                if (paint.filled()) {
                    upsert.setLong(1, mapId);
                    upsert.setInt(2, paint.x());
                    upsert.setInt(3, paint.y());
                    if (paint.roomId() != null) {
                        upsert.setLong(4, paint.roomId());
                    } else {
                        upsert.setNull(4, java.sql.Types.INTEGER);
                    }
                    upsert.addBatch();
                } else {
                    delete.setLong(1, mapId);
                    delete.setInt(2, paint.x());
                    delete.setInt(3, paint.y());
                    delete.addBatch();
                }
            }
            upsert.executeBatch();
            delete.executeBatch();
        }
    }

    public static long upsertRoom(Connection conn, DungeonRoom room) throws SQLException {
        if (room.roomId() == null) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO dungeon_rooms(map_id, name, description, area_id) VALUES(?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, room.mapId());
                ps.setString(2, room.name());
                ps.setString(3, room.description());
                if (room.areaId() != null) {
                    ps.setLong(4, room.areaId());
                } else {
                    ps.setNull(4, java.sql.Types.INTEGER);
                }
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (!keys.next()) {
                        throw new SQLException("No generated key returned for dungeon_rooms insert");
                    }
                    return keys.getLong(1);
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, description=?, area_id=? WHERE room_id=?")) {
            ps.setString(1, room.name());
            ps.setString(2, room.description());
            if (room.areaId() != null) {
                ps.setLong(3, room.areaId());
            } else {
                ps.setNull(3, java.sql.Types.INTEGER);
            }
            ps.setLong(4, room.roomId());
            ps.executeUpdate();
            return room.roomId();
        }
    }

    public static List<DungeonRoom> getRooms(Connection conn, long mapId) throws SQLException {
        List<DungeonRoom> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, map_id, name, description, area_id FROM dungeon_rooms WHERE map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonRoom(
                            rs.getLong("room_id"),
                            rs.getLong("map_id"),
                            rs.getString("name"),
                            rs.getString("description"),
                            getNullableLong(rs, "area_id")));
                }
            }
        }
        return result;
    }

    public static void deleteRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement clearSquares = conn.prepareStatement(
                "UPDATE dungeon_squares SET room_id=NULL WHERE room_id=?");
             PreparedStatement deleteRoom = conn.prepareStatement(
                     "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            clearSquares.setLong(1, roomId);
            clearSquares.executeUpdate();
            deleteRoom.setLong(1, roomId);
            deleteRoom.executeUpdate();
        }
    }

    public static void assignSquareRoom(Connection conn, long squareId, Long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_squares SET room_id=? WHERE square_id=?")) {
            if (roomId != null) {
                ps.setLong(1, roomId);
            } else {
                ps.setNull(1, java.sql.Types.INTEGER);
            }
            ps.setLong(2, squareId);
            ps.executeUpdate();
        }
    }

    public static long upsertArea(Connection conn, DungeonArea area) throws SQLException {
        if (area.areaId() == null) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO dungeon_areas(map_id, name, description, encounter_table_id) VALUES(?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, area.mapId());
                ps.setString(2, area.name());
                ps.setString(3, area.description());
                if (area.encounterTableId() != null) {
                    ps.setLong(4, area.encounterTableId());
                } else {
                    ps.setNull(4, java.sql.Types.INTEGER);
                }
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (!keys.next()) {
                        throw new SQLException("No generated key returned for dungeon_areas insert");
                    }
                    return keys.getLong(1);
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_areas SET name=?, description=?, encounter_table_id=? WHERE area_id=?")) {
            ps.setString(1, area.name());
            ps.setString(2, area.description());
            if (area.encounterTableId() != null) {
                ps.setLong(3, area.encounterTableId());
            } else {
                ps.setNull(3, java.sql.Types.INTEGER);
            }
            ps.setLong(4, area.areaId());
            ps.executeUpdate();
            return area.areaId();
        }
    }

    public static List<DungeonArea> getAreas(Connection conn, long mapId) throws SQLException {
        List<DungeonArea> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT a.area_id, a.map_id, a.name, a.description, a.encounter_table_id, et.name AS encounter_table_name "
                        + "FROM dungeon_areas a "
                        + "LEFT JOIN encounter_tables et ON et.table_id = a.encounter_table_id "
                        + "WHERE a.map_id=? ORDER BY a.area_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonArea(
                            rs.getLong("area_id"),
                            rs.getLong("map_id"),
                            rs.getString("name"),
                            rs.getString("description"),
                            getNullableLong(rs, "encounter_table_id"),
                            rs.getString("encounter_table_name")));
                }
            }
        }
        return result;
    }

    public static void deleteArea(Connection conn, long areaId) throws SQLException {
        try (PreparedStatement clearRooms = conn.prepareStatement(
                "UPDATE dungeon_rooms SET area_id=NULL WHERE area_id=?");
             PreparedStatement deleteArea = conn.prepareStatement(
                     "DELETE FROM dungeon_areas WHERE area_id=?")) {
            clearRooms.setLong(1, areaId);
            clearRooms.executeUpdate();
            deleteArea.setLong(1, areaId);
            deleteArea.executeUpdate();
        }
    }

    public static void assignRoomArea(Connection conn, long roomId, Long areaId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET area_id=? WHERE room_id=?")) {
            if (areaId != null) {
                ps.setLong(1, areaId);
            } else {
                ps.setNull(1, java.sql.Types.INTEGER);
            }
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    public static List<DungeonEndpoint> getEndpoints(Connection conn, long mapId) throws SQLException {
        List<DungeonEndpoint> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT e.endpoint_id, e.map_id, e.square_id, e.name, e.notes, s.x, s.y "
                        + "FROM dungeon_endpoints e "
                        + "JOIN dungeon_squares s ON s.square_id = e.square_id "
                        + "WHERE e.map_id=? ORDER BY e.endpoint_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonEndpoint(
                            rs.getLong("endpoint_id"),
                            rs.getLong("map_id"),
                            rs.getLong("square_id"),
                            rs.getString("name"),
                            rs.getString("notes"),
                            rs.getInt("x"),
                            rs.getInt("y")));
                }
            }
        }
        return result;
    }

    public static Optional<DungeonEndpoint> findEndpoint(Connection conn, long endpointId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT e.endpoint_id, e.map_id, e.square_id, e.name, e.notes, s.x, s.y "
                        + "FROM dungeon_endpoints e "
                        + "JOIN dungeon_squares s ON s.square_id = e.square_id "
                        + "WHERE e.endpoint_id=?")) {
            ps.setLong(1, endpointId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(new DungeonEndpoint(
                        rs.getLong("endpoint_id"),
                        rs.getLong("map_id"),
                        rs.getLong("square_id"),
                        rs.getString("name"),
                        rs.getString("notes"),
                        rs.getInt("x"),
                        rs.getInt("y")));
            }
        }
    }

    public static long upsertEndpoint(Connection conn, DungeonEndpoint endpoint) throws SQLException {
        if (endpoint.endpointId() == null) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO dungeon_endpoints(map_id, square_id, name, notes) VALUES(?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, endpoint.mapId());
                ps.setLong(2, endpoint.squareId());
                ps.setString(3, endpoint.name());
                ps.setString(4, endpoint.notes());
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (!keys.next()) {
                        throw new SQLException("No generated key returned for dungeon_endpoints insert");
                    }
                    return keys.getLong(1);
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_endpoints SET name=?, notes=? WHERE endpoint_id=?")) {
            ps.setString(1, endpoint.name());
            ps.setString(2, endpoint.notes());
            ps.setLong(3, endpoint.endpointId());
            ps.executeUpdate();
            return endpoint.endpointId();
        }
    }

    public static void deleteEndpoint(Connection conn, long endpointId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_endpoints WHERE endpoint_id=?")) {
            ps.setLong(1, endpointId);
            ps.executeUpdate();
        }
    }

    public static List<DungeonLink> getLinks(Connection conn, long mapId) throws SQLException {
        List<DungeonLink> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT link_id, map_id, from_endpoint_id, to_endpoint_id, label, notes "
                        + "FROM dungeon_links WHERE map_id=? ORDER BY link_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonLink(
                            rs.getLong("link_id"),
                            rs.getLong("map_id"),
                            rs.getLong("from_endpoint_id"),
                            rs.getLong("to_endpoint_id"),
                            rs.getString("label"),
                            rs.getString("notes")));
                }
            }
        }
        return result;
    }

    public static Optional<Long> findExistingLink(Connection conn, long mapId, long endpointA, long endpointB) throws SQLException {
        long first = Math.min(endpointA, endpointB);
        long second = Math.max(endpointA, endpointB);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT link_id FROM dungeon_links "
                        + "WHERE map_id=? AND from_endpoint_id=? AND to_endpoint_id=?")) {
            ps.setLong(1, mapId);
            ps.setLong(2, first);
            ps.setLong(3, second);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(rs.getLong("link_id"));
                }
            }
        }
        return Optional.empty();
    }

    public static long insertLink(Connection conn, DungeonLink link) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_links(map_id, from_endpoint_id, to_endpoint_id, label, notes) VALUES(?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, link.mapId());
            ps.setLong(2, Math.min(link.fromEndpointId(), link.toEndpointId()));
            ps.setLong(3, Math.max(link.fromEndpointId(), link.toEndpointId()));
            ps.setString(4, link.label());
            ps.setString(5, link.notes());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for dungeon_links insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public static void deleteLink(Connection conn, long linkId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_links WHERE link_id=?")) {
            ps.setLong(1, linkId);
            ps.executeUpdate();
        }
    }

    public static void updateLinkLabel(Connection conn, long linkId, String label) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_links SET label=? WHERE link_id=?")) {
            ps.setString(1, label);
            ps.setLong(2, linkId);
            ps.executeUpdate();
        }
    }

    public static boolean areEndpointsLinked(Connection conn, long mapId, long endpointA, long endpointB) throws SQLException {
        return findExistingLink(conn, mapId, endpointA, endpointB).isPresent();
    }

    private static DungeonSquare mapSquare(ResultSet rs) throws SQLException {
        return new DungeonSquare(
                rs.getLong("square_id"),
                rs.getLong("map_id"),
                rs.getInt("x"),
                rs.getInt("y"),
                getNullableLong(rs, "room_id"),
                rs.getString("room_name"),
                getNullableLong(rs, "area_id"),
                rs.getString("area_name"));
    }

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
