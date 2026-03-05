package repositories;

import entities.Faction;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

public class FactionRepository {

    public static long insert(Connection conn, Faction faction) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO factions(name, color_hex, description) VALUES(?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, faction.Name);
                ps.setString(2, faction.ColorHex);
                ps.setString(3, faction.Description);
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    return keys.getLong(1);
                }
            }
        } catch (SQLException e) {
            System.err.println("FactionRepository.insert(): " + e.getMessage());
            return 0L;
        }
    }

    public static List<Faction> findAll(Connection conn) {
        try {
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT * FROM factions ORDER BY name")) {
                List<Faction> result = new ArrayList<>();
                while (rs.next()) result.add(mapRow(rs));
                return result;
            }
        } catch (SQLException e) {
            System.err.println("FactionRepository.findAll(): " + e.getMessage());
            return Collections.emptyList();
        }
    }

    public static Optional<Faction> findById(Connection conn, long factionId) {
        try {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT * FROM factions WHERE faction_id=?")) {
                ps.setLong(1, factionId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) return Optional.of(mapRow(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            System.err.println("FactionRepository.findById(): " + e.getMessage());
            return Optional.empty();
        }
    }

    private static Faction mapRow(ResultSet rs) throws SQLException {
        Faction f = new Faction();
        f.FactionId = rs.getLong("faction_id");
        f.Name = rs.getString("name");
        f.ColorHex = rs.getString("color_hex");
        f.Description = rs.getString("description");
        return f;
    }
}
