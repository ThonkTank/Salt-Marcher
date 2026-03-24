package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.stair.StairDirection;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.model.structures.stair.StairShape;

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
            String name,
            StairShape shape,
            StairDirection direction,
            int dimension1,
            int dimension2
    ) throws SQLException {
        DungeonSchemaSupport.ensureCompatibility(conn);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                        + " VALUES(?, ?, ?, ?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setString(2, name);
            ps.setString(3, (shape == null ? StairShape.LADDER : shape).name());
            ps.setInt(4, (direction == null ? StairDirection.defaultDirection() : direction).code());
            ps.setInt(5, Math.max(0, dimension1));
            ps.setInt(6, Math.max(0, dimension2));
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_stairs insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void replacePathNodes(Connection conn, long stairId, List<CubePoint> pathNodes) throws SQLException {
        DungeonSchemaSupport.ensureCompatibility(conn);
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
        DungeonSchemaSupport.ensureCompatibility(conn);
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
        DungeonSchemaSupport.ensureCompatibility(conn);
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_stairs WHERE stair_id=?")) {
            ps.setLong(1, stairId);
            ps.executeUpdate();
        }
    }
}
