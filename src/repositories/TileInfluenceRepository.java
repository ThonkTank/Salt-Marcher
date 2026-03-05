package repositories;

import entities.TileInfluence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class TileInfluenceRepository {

    public static List<TileInfluence> getInfluenceForTile(Connection conn, long tileId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT * FROM tile_faction_influence WHERE tile_id=? ORDER BY influence DESC")) {
                ps.setLong(1, tileId);
                List<TileInfluence> result = new ArrayList<>();
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        TileInfluence ti = new TileInfluence();
                        ti.TileId = rs.getLong("tile_id");
                        ti.FactionId = rs.getLong("faction_id");
                        ti.Influence = rs.getInt("influence");
                        ti.ControlType = rs.getString("control_type");
                        result.add(ti);
                    }
                }
                return result;
            }
        } catch (SQLException e) {
            System.err.println("TileInfluenceRepository.getInfluenceForTile(): " + e.getMessage());
            return Collections.emptyList();
        }
    }

    public static void setInfluence(Connection conn, TileInfluence ti) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO tile_faction_influence(tile_id, faction_id, influence, control_type) VALUES(?,?,?,?)"
                    + " ON CONFLICT(tile_id, faction_id) DO UPDATE SET influence=excluded.influence, control_type=excluded.control_type")) {
                ps.setLong(1, ti.TileId);
                ps.setLong(2, ti.FactionId);
                ps.setInt(3, ti.Influence);
                ps.setString(4, ti.ControlType != null ? ti.ControlType : "presence");
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("TileInfluenceRepository.setInfluence(): " + e.getMessage());
        }
    }
}
