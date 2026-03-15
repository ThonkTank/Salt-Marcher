package features.world.dungeonmap.repository.concept;

import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.model.domain.DungeonConceptNodeType;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public final class DungeonConceptNodePositionRepository {

    private DungeonConceptNodePositionRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonConceptNodePosition> getPositions(Connection conn, long mapId) throws SQLException {
        List<DungeonConceptNodePosition> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                // Legacy column name kept because there is no user-visible value in renaming the table field.
                "SELECT concept_position_id, map_id, concept_level_id, node_key, node_type, entrance_index, concept_connection_id, x, y "
                        + "FROM dungeon_concept_node_positions WHERE map_id=? ORDER BY concept_level_id, node_key")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(map(rs));
                }
            }
        }
        return result;
    }

    public static void upsertPositions(Connection conn, List<DungeonConceptNodePosition> positions) throws SQLException {
        try (PreparedStatement update = conn.prepareStatement(
                "UPDATE dungeon_concept_node_positions "
                        + "SET node_type=?, entrance_index=?, concept_connection_id=?, x=?, y=? "
                        + "WHERE map_id=? AND concept_level_id=? AND node_key=?");
             PreparedStatement insert = conn.prepareStatement(
                     "INSERT INTO dungeon_concept_node_positions("
                             + "map_id, concept_level_id, node_key, node_type, entrance_index, concept_connection_id, x, y"
                             + ") VALUES(?,?,?,?,?,?,?,?)",
                     Statement.RETURN_GENERATED_KEYS)) {
            for (DungeonConceptNodePosition position : positions) {
                if (position == null) {
                    continue;
                }
                update.setString(1, position.nodeType().persistenceValue());
                if (position.externalNodeIndex() == null) {
                    update.setNull(2, java.sql.Types.INTEGER);
                } else {
                    update.setInt(2, position.externalNodeIndex());
                }
                if (position.connectionId() == null) {
                    update.setNull(3, java.sql.Types.INTEGER);
                } else {
                    update.setLong(3, position.connectionId());
                }
                update.setDouble(4, position.x());
                update.setDouble(5, position.y());
                update.setLong(6, position.mapId());
                update.setLong(7, position.conceptLevelId());
                update.setString(8, position.nodeKey());
                if (update.executeUpdate() > 0) {
                    continue;
                }

                insert.setLong(1, position.mapId());
                insert.setLong(2, position.conceptLevelId());
                insert.setString(3, position.nodeKey());
                insert.setString(4, position.nodeType().persistenceValue());
                if (position.externalNodeIndex() == null) {
                    insert.setNull(5, java.sql.Types.INTEGER);
                } else {
                    insert.setInt(5, position.externalNodeIndex());
                }
                if (position.connectionId() == null) {
                    insert.setNull(6, java.sql.Types.INTEGER);
                } else {
                    insert.setLong(6, position.connectionId());
                }
                insert.setDouble(7, position.x());
                insert.setDouble(8, position.y());
                insert.executeUpdate();
            }
        }
    }

    public static void deletePositionsForNode(Connection conn, long conceptLevelId, String nodeKey) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_concept_node_positions WHERE concept_level_id=? AND node_key=?")) {
            ps.setLong(1, conceptLevelId);
            ps.setString(2, nodeKey);
            ps.executeUpdate();
        }
    }

    public static void deletePositionsForNode(Connection conn, String nodeKey) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_concept_node_positions WHERE node_key=?")) {
            ps.setString(1, nodeKey);
            ps.executeUpdate();
        }
    }

    public static void deletePosition(Connection conn, Long conceptPositionId) throws SQLException {
        if (conceptPositionId == null) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_concept_node_positions WHERE concept_position_id=?")) {
            ps.setLong(1, conceptPositionId);
            ps.executeUpdate();
        }
    }

    private static DungeonConceptNodePosition map(ResultSet rs) throws SQLException {
        Integer externalNodeIndex = rs.getObject("entrance_index") == null ? null : rs.getInt("entrance_index");
        Long connectionId = rs.getObject("concept_connection_id") == null ? null : rs.getLong("concept_connection_id");
        return new DungeonConceptNodePosition(
                rs.getLong("concept_position_id"),
                rs.getLong("map_id"),
                rs.getLong("concept_level_id"),
                rs.getString("node_key"),
                DungeonConceptNodeType.fromPersistenceValue(rs.getString("node_type")),
                externalNodeIndex,
                connectionId,
                rs.getDouble("x"),
                rs.getDouble("y"));
    }
}
