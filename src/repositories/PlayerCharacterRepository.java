package repositories;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import entities.PlayerCharacter;

public class PlayerCharacterRepository {

    private static PlayerCharacter mapRow(ResultSet rs) throws SQLException {
        PlayerCharacter pc = new PlayerCharacter();
        pc.Id    = rs.getLong("id");
        pc.Name  = rs.getString("name");
        pc.Level = rs.getInt("level");
        return pc;
    }

    public static Optional<PlayerCharacter> createCharacter(Connection conn, String name, int level) throws SQLException {
        String sql = "INSERT INTO player_characters(name, level) VALUES(?,?)";
        try (PreparedStatement ps = conn.prepareStatement(sql,
                java.sql.Statement.RETURN_GENERATED_KEYS)) {

            ps.setString(1, name);
            ps.setInt(2, level);
            ps.executeUpdate();

            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    PlayerCharacter pc = new PlayerCharacter();
                    pc.Id    = keys.getLong(1);
                    pc.Name  = name;
                    pc.Level = level;
                    return Optional.of(pc);
                }
            }
        }
        return Optional.empty();
    }

    public static List<PlayerCharacter> getPartyMembers(Connection conn) throws SQLException {
        List<PlayerCharacter> list = new ArrayList<>();
        String sql = "SELECT id, name, level FROM player_characters WHERE in_party = 1 ORDER BY id";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public static List<PlayerCharacter> getAvailableCharacters(Connection conn) throws SQLException {
        List<PlayerCharacter> list = new ArrayList<>();
        String sql = "SELECT id, name, level FROM player_characters WHERE in_party = 0 ORDER BY name";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public static void addToParty(Connection conn, long id) throws SQLException {
        String sql = "UPDATE player_characters SET in_party = 1 WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        }
    }

    public static void removeFromParty(Connection conn, long id) throws SQLException {
        String sql = "UPDATE player_characters SET in_party = 0 WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        }
    }

    public static void updateCharacter(Connection conn, long id, String name, int level) throws SQLException {
        String sql = "UPDATE player_characters SET name=?, level=? WHERE id=?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            ps.setInt(2, level);
            ps.setLong(3, id);
            ps.executeUpdate();
        }
    }

    public static void deleteCharacter(Connection conn, long id) throws SQLException {
        String sql = "DELETE FROM player_characters WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        }
    }
}
