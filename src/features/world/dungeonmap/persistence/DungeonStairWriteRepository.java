package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Objects;

/**
 * Persists only the canonical stair owner fields: top-level identity/name and the explicit ordered path.
 *
 * <p>Do not reintroduce generated spec fields or persisted exits here. Those are intentionally derived outside
 * persistence from the path plus the loaded room/corridor layout.
 */
public final class DungeonStairWriteRepository {

    public long insertStair(
            Connection conn,
            long mapId,
            DungeonStair stair
    ) throws SQLException {
        DungeonStair resolvedStair = Objects.requireNonNull(stair, "stair");
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_stairs(dungeon_map_id, name) VALUES(?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setString(2, resolvedStair.name());
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
                "UPDATE dungeon_stairs SET name=? WHERE stair_id=?")) {
            ps.setString(1, resolvedStair.name());
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
            // Path order is the whole stair geometry contract.
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

    public void deleteStair(Connection conn, long stairId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_stairs WHERE stair_id=?")) {
            ps.setLong(1, stairId);
            ps.executeUpdate();
        }
    }
}
