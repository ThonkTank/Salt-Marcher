package features.party.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import features.party.model.PlayerCharacter;
import features.party.service.PartyProgressionRules;

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
        pc.CurrentXp = rs.getInt("current_xp");
        pc.XpSinceLongRest = rs.getInt("xp_since_long_rest");
        pc.XpSinceShortRest = rs.getInt("xp_since_short_rest");
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
        // Legacy compatibility: short_rests_taken stays in the table shape for existing DBs,
        // but new gameplay logic no longer reads it into the active party model.
        String sql = "INSERT INTO player_characters("
                + "name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest, short_rests_taken,"
                + " passive_perception, ac, in_party) VALUES(?,?,?,?,?,?,?,?,?,?)";
        try (PreparedStatement ps = conn.prepareStatement(sql,
                java.sql.Statement.RETURN_GENERATED_KEYS)) {

            int safeCurrentXp = PartyProgressionRules.minimumXpForLevel(level);
            ps.setString(1, name);
            ps.setString(2, blankToNull(playerName));
            ps.setInt(3, level);
            ps.setInt(4, safeCurrentXp);
            ps.setInt(5, 0);
            ps.setInt(6, 0);
            ps.setInt(7, 0);
            ps.setInt(8, passivePerception);
            ps.setInt(9, armorClass);
            ps.setInt(10, inParty ? 1 : 0);
            ps.executeUpdate();

            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    PlayerCharacter pc = new PlayerCharacter();
                    pc.Id = keys.getLong(1);
                    pc.Name = name;
                    pc.PlayerName = blankToNull(playerName);
                    pc.Level = level;
                    pc.CurrentXp = safeCurrentXp;
                    pc.XpSinceLongRest = 0;
                    pc.XpSinceShortRest = 0;
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
        String sql = "SELECT id, name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest,"
                + " passive_perception, ac "
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
        String sql = "SELECT id, name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest,"
                + " passive_perception, ac "
                + "FROM player_characters WHERE in_party = 0 ORDER BY name";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public static PlayerCharacter getCharacterById(Connection conn, Long id) throws SQLException {
        String sql = "SELECT id, name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest,"
                + " passive_perception, ac FROM player_characters WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return mapRow(rs);
            }
        }
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
            int currentXp,
            int passivePerception,
            int armorClass
    ) throws SQLException {
        String sql = "UPDATE player_characters "
                + "SET name = ?, player_name = ?, level = ?, current_xp = ?, passive_perception = ?, ac = ? "
                + "WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            ps.setString(2, blankToNull(playerName));
            ps.setInt(3, level);
            ps.setInt(4, currentXp);
            ps.setInt(5, passivePerception);
            ps.setInt(6, armorClass);
            ps.setLong(7, id);
            return ps.executeUpdate() > 0;
        }
    }

    public static int awardXpToCharacter(Connection conn, Long id, int xpAmount) throws SQLException {
        String sql = "UPDATE player_characters SET current_xp = current_xp + ? WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int safeXpAmount = Math.max(0, xpAmount);
            ps.setInt(1, safeXpAmount);
            ps.setLong(2, id);
            return ps.executeUpdate();
        }
    }

    public static int awardXpToCharacters(Connection conn, List<Long> ids, int xpAmount) throws SQLException {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        int safeXpAmount = Math.max(0, xpAmount);
        String sql = "UPDATE player_characters SET current_xp = current_xp + ?, xp_since_long_rest = xp_since_long_rest + ?,"
                + " xp_since_short_rest = xp_since_short_rest + ? WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (Long id : ids) {
                if (id == null) {
                    continue;
                }
                ps.setInt(1, safeXpAmount);
                ps.setInt(2, safeXpAmount);
                ps.setInt(3, safeXpAmount);
                ps.setLong(4, id);
                ps.addBatch();
            }
            int[] counts = ps.executeBatch();
            int updated = 0;
            for (int count : counts) {
                updated += Math.max(0, count);
            }
            return updated;
        }
    }

    public static int performShortRest(Connection conn) throws SQLException {
        // Intentional: this app does not limit how many short rests the GM may take.
        // Short rest only resets progress toward the next short-rest segment; long rest resets the full day.
        String sql = "UPDATE player_characters "
                + "SET xp_since_short_rest = 0 "
                + "WHERE in_party = 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            return ps.executeUpdate();
        }
    }

    public static int performLongRest(Connection conn) throws SQLException {
        String sql = "UPDATE player_characters "
                + "SET xp_since_long_rest = 0, xp_since_short_rest = 0 "
                + "WHERE in_party = 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            return ps.executeUpdate();
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
