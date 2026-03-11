package features.encountertable.repository;

import features.encountertable.model.EncounterTable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class EncounterTableRepository {

    public record GeneratorSelection(Map<Long, Integer> weights) {}

    private EncounterTableRepository() {
        throw new AssertionError("No instances");
    }

    // ---- Read ---------------------------------------------------------------

    /** Returns all tables (name + description only, no entries loaded). */
    public static List<EncounterTable> getAll(Connection conn) throws SQLException {
        List<EncounterTable> tables = new ArrayList<>();
        String sql = "SELECT t.table_id, t.name, t.description, l.loot_table_id"
                + " FROM encounter_tables t"
                + " LEFT JOIN encounter_table_loot_links l ON l.table_id = t.table_id"
                + " ORDER BY t.name";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                EncounterTable t = new EncounterTable();
                t.tableId     = rs.getLong("table_id");
                t.name        = rs.getString("name");
                t.description = rs.getString("description");
                t.linkedLootTableId = nullableLong(rs, "loot_table_id");
                tables.add(t);
            }
        }
        return tables;
    }

    /** Returns a single table with all entries loaded via a JOIN on creatures. */
    public static EncounterTable getWithEntries(Connection conn, long tableId) throws SQLException {
        EncounterTable table = null;
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT t.table_id, t.name, t.description, l.loot_table_id"
                        + " FROM encounter_tables t"
                        + " LEFT JOIN encounter_table_loot_links l ON l.table_id = t.table_id"
                        + " WHERE t.table_id = ?")) {
            ps.setLong(1, tableId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    table = new EncounterTable();
                    table.tableId     = rs.getLong("table_id");
                    table.name        = rs.getString("name");
                    table.description = rs.getString("description");
                    table.linkedLootTableId = nullableLong(rs, "loot_table_id");
                }
            }
        }
        if (table == null) return null;

        table.entries = new ArrayList<>();
        String sql = "SELECT e.creature_id, e.weight, c.name, c.creature_type, c.cr, c.xp"
                   + " FROM encounter_table_entries e"
                   + " JOIN creatures c ON c.id = e.creature_id"
                   + " WHERE e.table_id = ?"
                   + " ORDER BY c.name";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, tableId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    table.entries.add(new EncounterTable.Entry(
                        rs.getLong("creature_id"),
                        rs.getString("name"),
                        rs.getString("creature_type"),
                        rs.getString("cr"),
                        rs.getInt("xp"),
                        rs.getInt("weight")
                    ));
                }
            }
        }
        return table;
    }

    /**
     * Loads unique creature IDs for the encounter generator plus selection weights.
     * Only creatures with XP <= maxXp are included.
     */
    public static GeneratorSelection getSelectionForGenerator(Connection conn, List<Long> tableIds, int maxXp)
            throws SQLException {
        if (tableIds == null || tableIds.isEmpty()) return new GeneratorSelection(Map.of());

        Map<Long, Integer> weights = new HashMap<>();
        String ph = String.join(",", Collections.nCopies(tableIds.size(), "?"));
        String sql = "SELECT e.creature_id, MAX(e.weight) as weight"
                   + " FROM encounter_table_entries e"
                   + " JOIN creatures c ON c.id = e.creature_id"
                   + " WHERE e.table_id IN (" + ph + ") AND c.xp <= ?"
                   + " GROUP BY e.creature_id";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < tableIds.size(); i++) ps.setLong(i + 1, tableIds.get(i));
            ps.setInt(tableIds.size() + 1, maxXp);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) weights.put(rs.getLong("creature_id"), rs.getInt("weight"));
            }
        }
        if (weights.isEmpty()) return new GeneratorSelection(Map.of());
        return new GeneratorSelection(weights);
    }

    // ---- Write ---------------------------------------------------------------

    /** Creates a new encounter table and returns its generated table_id. */
    public static long create(Connection conn, String name, String description) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO encounter_tables(name, description) VALUES(?, ?)",
                java.sql.Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.setString(2, description);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) return keys.getLong(1);
                throw new SQLException("EncounterTableRepository.create(): no generated key returned");
            }
        }
    }

    /** Returns whether a normalized table name already exists (optionally excluding one table_id). */
    public static boolean existsByNormalizedName(Connection conn, String name, Long excludeTableId) throws SQLException {
        String sql = "SELECT 1 FROM encounter_tables"
                   + " WHERE lower(trim(name)) = lower(trim(?))";
        if (excludeTableId != null) sql += " AND table_id <> ?";
        sql += " LIMIT 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            if (excludeTableId != null) ps.setLong(2, excludeTableId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    /** Renames an encounter table. */
    public static void rename(Connection conn, long tableId, String name) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE encounter_tables SET name = ? WHERE table_id = ?")) {
            ps.setString(1, name);
            ps.setLong(2, tableId);
            ps.executeUpdate();
        }
    }

    /** Deletes an encounter table. Cascade deletes all entries. */
    public static void delete(Connection conn, long tableId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM encounter_tables WHERE table_id = ?")) {
            ps.setLong(1, tableId);
            ps.executeUpdate();
        }
    }

    /** Adds a creature to a table with the given weight. No-op if already present (INSERT OR IGNORE). */
    public static void addEntry(Connection conn, long tableId, long creatureId, int weight) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT OR IGNORE INTO encounter_table_entries(table_id, creature_id, weight) VALUES(?, ?, ?)")) {
            ps.setLong(1, tableId);
            ps.setLong(2, creatureId);
            ps.setInt(3, weight);
            ps.executeUpdate();
        }
    }

    /** Removes a creature from a table. */
    public static void removeEntry(Connection conn, long tableId, long creatureId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM encounter_table_entries WHERE table_id = ? AND creature_id = ?")) {
            ps.setLong(1, tableId);
            ps.setLong(2, creatureId);
            ps.executeUpdate();
        }
    }

    /** Updates the weight of a creature in a table. */
    public static void updateWeight(Connection conn, long tableId, long creatureId, int weight) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE encounter_table_entries SET weight = ? WHERE table_id = ? AND creature_id = ?")) {
            ps.setInt(1, weight);
            ps.setLong(2, tableId);
            ps.setLong(3, creatureId);
            ps.executeUpdate();
        }
    }

    public static void updateLinkedLootTable(Connection conn, long tableId, Long lootTableId) throws SQLException {
        boolean previousAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);
        try {
            try (PreparedStatement delete = conn.prepareStatement(
                    "DELETE FROM encounter_table_loot_links WHERE table_id = ?")) {
                delete.setLong(1, tableId);
                delete.executeUpdate();
            }
            if (lootTableId != null) {
                try (PreparedStatement insert = conn.prepareStatement(
                        "INSERT INTO encounter_table_loot_links(table_id, loot_table_id) VALUES(?, ?)")) {
                    insert.setLong(1, tableId);
                    insert.setLong(2, lootTableId);
                    insert.executeUpdate();
                }
            }
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(previousAutoCommit);
        }
    }

    public static List<Long> getDistinctLinkedLootTableIds(Connection conn, List<Long> tableIds) throws SQLException {
        if (tableIds == null || tableIds.isEmpty()) {
            return List.of();
        }
        String ph = String.join(",", Collections.nCopies(tableIds.size(), "?"));
        String sql = "SELECT DISTINCT loot_table_id FROM encounter_table_loot_links WHERE table_id IN (" + ph + ")";
        List<Long> lootTableIds = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < tableIds.size(); i++) {
                ps.setLong(i + 1, tableIds.get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    lootTableIds.add(rs.getLong("loot_table_id"));
                }
            }
        }
        return lootTableIds;
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
