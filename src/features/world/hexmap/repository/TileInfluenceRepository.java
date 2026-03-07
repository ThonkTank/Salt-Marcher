package features.world.hexmap.repository;

import features.world.hexmap.model.TileControlType;
import features.world.hexmap.model.TileInfluence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class TileInfluenceRepository {

    private TileInfluenceRepository() {
        throw new AssertionError("No instances");
    }

    public static List<TileInfluence> getInfluenceForTile(Connection conn, long tileId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM tile_faction_influence WHERE tile_id=? ORDER BY influence DESC")) {
            ps.setLong(1, tileId);
            List<TileInfluence> result = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String rawControlType = rs.getString("control_type");
                    TileControlType controlType = TileControlType.fromKey(rawControlType)
                            .orElseThrow(() -> new SQLException("Unknown control_type: " + rawControlType));
                    result.add(new TileInfluence(
                            rs.getLong("tile_id"),
                            rs.getLong("faction_id"),
                            rs.getInt("influence"),
                            controlType));
                }
            }
            return result;
        }
    }

    public static void setInfluence(Connection conn, TileInfluence ti) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO tile_faction_influence(tile_id, faction_id, influence, control_type) VALUES(?,?,?,?)"
                        + " ON CONFLICT(tile_id, faction_id) DO UPDATE SET influence=excluded.influence, control_type=excluded.control_type")) {
            ps.setLong(1, ti.tileId());
            ps.setLong(2, ti.factionId());
            ps.setInt(3, ti.influence());
            TileControlType controlType = ti.controlType() != null ? ti.controlType() : TileControlType.PRESENCE;
            ps.setString(4, controlType.dbValue());
            ps.executeUpdate();
        }
    }
}
