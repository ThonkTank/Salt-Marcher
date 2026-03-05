package repositories;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import database.DatabaseManager;
import entities.PlayerCharacter;

public class PlayerCharacterRepository {

    private static PlayerCharacter mapPlayerCharacter(ResultSet rs) throws SQLException {
        PlayerCharacter pc = new PlayerCharacter();
        pc.Id    = rs.getLong("id");
        pc.Name  = rs.getString("name");
        pc.Level = rs.getInt("level");
        return pc;
    }

    public static Optional<PlayerCharacter> createCharacter(String name, int level) {
        String sql = "INSERT INTO player_characters(name, level) VALUES(?,?)";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql,
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
        } catch (SQLException e) {
            System.err.println("PlayerCharacterRepository.createCharacter(): " + e.getMessage());
        }
        return Optional.empty();
    }

    public static List<PlayerCharacter> getPartyMembers() {
        List<PlayerCharacter> list = new ArrayList<>();
        String sql = "SELECT id, name, level FROM player_characters WHERE in_party = 1 ORDER BY id";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapPlayerCharacter(rs));
        } catch (SQLException e) {
            System.err.println("PlayerCharacterRepository.getPartyMembers(): " + e.getMessage());
        }
        return list;
    }

    public static List<PlayerCharacter> getAvailableCharacters() {
        List<PlayerCharacter> list = new ArrayList<>();
        String sql = "SELECT id, name, level FROM player_characters WHERE in_party = 0 ORDER BY name";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapPlayerCharacter(rs));
        } catch (SQLException e) {
            System.err.println("PlayerCharacterRepository.getAvailableCharacters(): " + e.getMessage());
        }
        return list;
    }

    public static void addToParty(long id) {
        String sql = "UPDATE player_characters SET in_party = 1 WHERE id = ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("PlayerCharacterRepository.addToParty(): " + e.getMessage());
        }
    }

    public static void removeFromParty(long id) {
        String sql = "UPDATE player_characters SET in_party = 0 WHERE id = ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("PlayerCharacterRepository.removeFromParty(): " + e.getMessage());
        }
    }

    public static void updateCharacter(long id, String name, int level) {
        String sql = "UPDATE player_characters SET name=?, level=? WHERE id=?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            ps.setInt(2, level);
            ps.setLong(3, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("PlayerCharacterRepository.updateCharacter(): " + e.getMessage());
        }
    }

    public static void deleteCharacter(long id) {
        String sql = "DELETE FROM player_characters WHERE id = ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("PlayerCharacterRepository.deleteCharacter(): " + e.getMessage());
        }
    }
}
