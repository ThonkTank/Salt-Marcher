package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonArea;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public final class DungeonAreaRepository {

    private DungeonAreaRepository() {
        throw new AssertionError("No instances");
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

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
