package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

public final class DungeonStairWriteRepository {

    public long insertStair(
            Connection conn,
            long mapId,
            long traversalId,
            String segmentKey
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_stairs(dungeon_map_id, traversal_id, segment_key)"
                        + " VALUES(?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, traversalId);
            ps.setString(3, segmentKey);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_stairs insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void updateTraversalStair(
            Connection conn,
            long stairId,
            String segmentKey
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_stairs"
                        + " SET segment_key=?"
                        + " WHERE stair_id=?")) {
            ps.setString(1, segmentKey);
            ps.setLong(2, stairId);
            ps.executeUpdate();
        }
    }

    public void replacePathNodes(Connection conn, long stairId, List<CubePoint> pathNodes) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_stair_path_nodes WHERE stair_id=?")) {
            delete.setLong(1, stairId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_stair_path_nodes(stair_id, sort_order, cell_x, cell_y, cell_z) VALUES(?,?,?,?,?)")) {
            for (int index = 0; index < pathNodes.size(); index++) {
                CubePoint node = pathNodes.get(index);
                insert.setLong(1, stairId);
                insert.setInt(2, index);
                insert.setInt(3, node.x());
                insert.setInt(4, node.y());
                insert.setInt(5, node.z());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void replaceExits(Connection conn, long stairId, List<DungeonStairExit> exits) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_stair_exits WHERE stair_id=?")) {
            delete.setLong(1, stairId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_stair_exits(stair_id, cell_x, cell_y, cell_z, label) VALUES(?,?,?,?,?)")) {
            for (DungeonStairExit exit : exits) {
                insert.setLong(1, stairId);
                insert.setInt(2, exit.position().x());
                insert.setInt(3, exit.position().y());
                insert.setInt(4, exit.position().z());
                insert.setString(5, exit.label());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void deleteStair(Connection conn, long stairId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_stairs WHERE stair_id=?")) {
            ps.setLong(1, stairId);
            ps.executeUpdate();
        }
    }

}
