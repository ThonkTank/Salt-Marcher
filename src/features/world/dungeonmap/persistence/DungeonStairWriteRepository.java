package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Objects;

public final class DungeonStairWriteRepository {

    public long insertStair(
            Connection conn,
            long mapId,
            DungeonStair stair
    ) throws SQLException {
        DungeonStair resolvedStair = Objects.requireNonNull(stair, "stair");
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_stairs("
                        + "dungeon_map_id, name, anchor_x, anchor_y, shape, direction, dimension1, dimension2"
                        + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            bindStairSpecification(ps, 2, resolvedStair);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_stairs insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void updateStair(
            Connection conn,
            long stairId,
            DungeonStair stair
    ) throws SQLException {
        DungeonStair resolvedStair = Objects.requireNonNull(stair, "stair");
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_stairs"
                        + " SET name=?, anchor_x=?, anchor_y=?, shape=?, direction=?, dimension1=?, dimension2=?"
                        + " WHERE stair_id=?")) {
            bindStairSpecification(ps, 1, resolvedStair);
            ps.setLong(8, stairId);
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

    private static void bindStairSpecification(
            PreparedStatement ps,
            int startIndex,
            DungeonStair stair
    ) throws SQLException {
        ps.setString(startIndex, stair.name());
        ps.setInt(startIndex + 1, stair.anchor().x());
        ps.setInt(startIndex + 2, stair.anchor().y());
        ps.setString(startIndex + 3, stair.shape().name());
        ps.setString(startIndex + 4, stair.direction().name());
        ps.setInt(startIndex + 5, stair.dimension1());
        ps.setInt(startIndex + 6, stair.dimension2());
    }

}
