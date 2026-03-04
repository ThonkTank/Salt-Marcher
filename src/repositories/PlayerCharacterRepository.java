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
                    long id = keys.getLong(1);
                    // Fetch via mapper to ensure consistency
                    String selectSql = "SELECT id, name, level FROM player_characters WHERE id = ?";
                    try (PreparedStatement selectPs = conn.prepareStatement(selectSql)) {
                        selectPs.setLong(1, id);
                        try (ResultSet rs = selectPs.executeQuery()) {
                            if (rs.next()) return mapPlayerCharacter(rs);
                        }
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("Fehler beim Erstellen: " + e.getMessage());
        }
        return null;
    }

    public static List<PlayerCharacter> getPartyMembers() {
        List<PlayerCharacter> list = new ArrayList<>();
        String sql = "SELECT id, name, level FROM player_characters WHERE in_party = 1 ORDER BY id";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapPlayerCharacter(rs));
        } catch (SQLException e) {
            System.err.println("Fehler beim Laden der Party: " + e.getMessage());
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
            System.err.println("Fehler beim Laden verfügbarer Charaktere: " + e.getMessage());
        }
        return list;
    }

    public static void addToParty(Long id) {
        String sql = "UPDATE player_characters SET in_party = 1 WHERE id = ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("Fehler beim Hinzufügen zur Party: " + e.getMessage());
        }
    }

    public static void removeFromParty(Long id) {
        String sql = "UPDATE player_characters SET in_party = 0 WHERE id = ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("Fehler beim Entfernen aus der Party: " + e.getMessage());
        }
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
