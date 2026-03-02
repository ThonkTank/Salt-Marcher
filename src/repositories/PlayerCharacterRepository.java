package repositories;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

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

    public static PlayerCharacter createCharacter(String name, int level) {
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
                    return pc;
                }
            }
        } catch (SQLException e) {
            System.err.println("Fehler beim Erstellen: " + e.getMessage());
        }
        return null;
    }

    public static List<PlayerCharacter> getAllCharacters() {
        List<PlayerCharacter> list = new ArrayList<>();
        String sql = "SELECT id, name, level FROM player_characters ORDER BY id";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                list.add(mapPlayerCharacter(rs));
            }
        } catch (SQLException e) {
            System.err.println("Fehler beim Laden aller Charaktere: " + e.getMessage());
        }
        return list;
    }

    public static void saveCharacter(PlayerCharacter pc) {
        String sql = "INSERT INTO player_characters(id, name, level) VALUES(?,?,?)";

        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, pc.Id);
            ps.setString(2, pc.Name);
            ps.setInt(3, pc.Level);
            ps.executeUpdate();

        } catch (SQLException e) {
            System.err.println("Fehler beim Speichern: " + e.getMessage());
        }
    }

    public static PlayerCharacter getCharacter(Long id) {
        String sql = "SELECT id, name, level FROM player_characters WHERE id = ?";

        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapPlayerCharacter(rs);
                }
            }
        } catch (SQLException e) {
            System.err.println("Fehler beim Laden: " + e.getMessage());
        }
        return null;
    }

    public static void deleteCharacter(Long id) {
        String sql = "DELETE FROM player_characters WHERE id = ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("Fehler beim Löschen: " + e.getMessage());
        }
    }
}
