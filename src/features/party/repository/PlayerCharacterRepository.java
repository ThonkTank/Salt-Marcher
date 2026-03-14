package features.party.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import features.party.model.PlayerCharacter;

public final class PlayerCharacterRepository {

    private PlayerCharacterRepository() {
        throw new AssertionError("No instances");
    }

    private static PlayerCharacter mapRow(ResultSet rs) throws SQLException {
        PlayerCharacter pc = new PlayerCharacter();
        pc.Id = rs.getLong("id");
        pc.Name = rs.getString("name");
        pc.PlayerName = rs.getString("player_name");
        pc.Level = rs.getInt("level");
        pc.PassivePerception = rs.getInt("passive_perception");
        pc.ArmorClass = rs.getInt("ac");
        return pc;
    }

    public static PlayerCharacter createCharacter(
            Connection conn,
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass,
            boolean inParty
    ) throws SQLException {
        String sql = "INSERT INTO player_characters(name, player_name, level, passive_perception, ac, in_party) "
                + "VALUES(?,?,?,?,?,?)";
        try (PreparedStatement ps = conn.prepareStatement(sql,
                java.sql.Statement.RETURN_GENERATED_KEYS)) {

            ps.setString(1, name);
            ps.setString(2, blankToNull(playerName));
            ps.setInt(3, level);
            ps.setInt(4, passivePerception);
            ps.setInt(5, armorClass);
            ps.setInt(6, inParty ? 1 : 0);
            ps.executeUpdate();

            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    PlayerCharacter pc = new PlayerCharacter();
                    pc.Id = keys.getLong(1);
                    pc.Name = name;
                    pc.PlayerName = blankToNull(playerName);
                    pc.Level = level;
                    pc.PassivePerception = passivePerception;
                    pc.ArmorClass = armorClass;
                    return pc;
                }
            }
        }
        return null;
    }

    public static List<PlayerCharacter> getPartyMembers(Connection conn) throws SQLException {
        List<PlayerCharacter> list = new ArrayList<>();
        String sql = "SELECT id, name, player_name, level, passive_perception, ac "
                + "FROM player_characters WHERE in_party = 1 ORDER BY id";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public static List<Integer> getActivePartyLevels(Connection conn) throws SQLException {
        List<Integer> levels = new ArrayList<>();
        String sql = "SELECT level FROM player_characters WHERE in_party = 1 ORDER BY id";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                levels.add(rs.getInt("level"));
            }
        }
        return levels;
    }

    public static List<Integer> getActivePartyLevelsForComposition(Connection conn) throws SQLException {
        List<Integer> levels = new ArrayList<>();
        String sql = "SELECT level FROM player_characters WHERE in_party = 1 ORDER BY level ASC, id ASC";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                levels.add(rs.getInt("level"));
            }
        }
        return levels;
    }

    public static List<PlayerCharacter> getAvailableCharacters(Connection conn) throws SQLException {
        List<PlayerCharacter> list = new ArrayList<>();
        String sql = "SELECT id, name, player_name, level, passive_perception, ac "
                + "FROM player_characters WHERE in_party = 0 ORDER BY name";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public static boolean addToParty(Connection conn, Long id) throws SQLException {
        String sql = "UPDATE player_characters SET in_party = 1 WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    public static boolean removeFromParty(Connection conn, Long id) throws SQLException {
        String sql = "UPDATE player_characters SET in_party = 0 WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    public static boolean updateCharacter(
            Connection conn,
            Long id,
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) throws SQLException {
        String sql = "UPDATE player_characters "
                + "SET name = ?, player_name = ?, level = ?, passive_perception = ?, ac = ? "
                + "WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            ps.setString(2, blankToNull(playerName));
            ps.setInt(3, level);
            ps.setInt(4, passivePerception);
            ps.setInt(5, armorClass);
            ps.setLong(6, id);
            return ps.executeUpdate() > 0;
        }
    }

    public static boolean deleteCharacter(Connection conn, Long id) throws SQLException {
        String sql = "DELETE FROM player_characters WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
