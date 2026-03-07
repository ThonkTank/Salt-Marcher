package features.world.hexmap.repository;

import features.world.hexmap.model.Faction;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class FactionRepository {

    private FactionRepository() {
        throw new AssertionError("No instances");
    }

    public static long insert(Connection conn, Faction faction) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO factions(name, color_hex, description) VALUES(?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, faction.name());
            ps.setString(2, faction.colorHex());
            ps.setString(3, faction.description());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for factions insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public static List<Faction> findAll(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM factions ORDER BY name")) {
            List<Faction> result = new ArrayList<>();
            while (rs.next()) {
                result.add(mapRow(rs));
            }
            return result;
        }
    }

    public static Optional<Faction> findById(Connection conn, long factionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM factions WHERE faction_id=?")) {
            ps.setLong(1, factionId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        }
        return Optional.empty();
    }

    private static Faction mapRow(ResultSet rs) throws SQLException {
        return new Faction(
                rs.getLong("faction_id"),
                rs.getString("name"),
                rs.getString("color_hex"),
                rs.getString("description"));
    }
}
