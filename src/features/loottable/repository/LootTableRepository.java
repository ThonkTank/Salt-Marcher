package features.loottable.repository;

import features.loottable.model.LootTable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class LootTableRepository {
    private LootTableRepository() {
        throw new AssertionError("No instances");
    }

    public static List<LootTable> getAll(Connection conn) throws SQLException {
        List<LootTable> tables = new ArrayList<>();
        String sql = "SELECT loot_table_id, name, description FROM loot_tables ORDER BY name";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                LootTable table = new LootTable();
                table.tableId = rs.getLong("loot_table_id");
                table.name = rs.getString("name");
                table.description = rs.getString("description");
                tables.add(table);
            }
        }
        return tables;
    }

    public static LootTable getWithEntries(Connection conn, long tableId) throws SQLException {
        LootTable table = null;
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT loot_table_id, name, description FROM loot_tables WHERE loot_table_id = ?")) {
            ps.setLong(1, tableId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    table = new LootTable();
                    table.tableId = rs.getLong("loot_table_id");
                    table.name = rs.getString("name");
                    table.description = rs.getString("description");
                }
            }
        }
        if (table == null) {
            return null;
        }

        table.entries = new ArrayList<>();
        String sql = "SELECT e.item_id, e.weight, i.name, i.category, i.rarity, i.cost_cp, i.cost"
                + " FROM loot_table_entries e"
                + " JOIN items i ON i.id = e.item_id"
                + " WHERE e.loot_table_id = ?"
                + " ORDER BY i.name";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, tableId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    table.entries.add(new LootTable.Entry(
                            rs.getLong("item_id"),
                            rs.getString("name"),
                            rs.getString("category"),
                            rs.getString("rarity"),
                            rs.getInt("cost_cp"),
                            rs.getString("cost"),
                            rs.getInt("weight")
                    ));
                }
            }
        }
        return table;
    }

    public static List<LootTable.Entry> getWeightedItems(Connection conn, long lootTableId) throws SQLException {
        List<LootTable.Entry> items = new ArrayList<>();
        String sql = "SELECT e.item_id, e.weight, i.name, i.category, i.rarity, i.cost_cp, i.cost"
                + " FROM loot_table_entries e"
                + " JOIN items i ON i.id = e.item_id"
                + " WHERE e.loot_table_id = ?"
                + " ORDER BY i.name";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, lootTableId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    items.add(new LootTable.Entry(
                            rs.getLong("item_id"),
                            rs.getString("name"),
                            rs.getString("category"),
                            rs.getString("rarity"),
                            rs.getInt("cost_cp"),
                            rs.getString("cost"),
                            rs.getInt("weight")
                    ));
                }
            }
        }
        return items;
    }

    public static long create(Connection conn, String name, String description) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO loot_tables(name, description) VALUES(?, ?)",
                java.sql.Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.setString(2, description);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) return keys.getLong(1);
                throw new SQLException("LootTableRepository.create(): no generated key returned");
            }
        }
    }

    public static boolean existsByNormalizedName(Connection conn, String name, Long excludeTableId) throws SQLException {
        String sql = "SELECT 1 FROM loot_tables WHERE lower(trim(name)) = lower(trim(?))";
        if (excludeTableId != null) {
            sql += " AND loot_table_id <> ?";
        }
        sql += " LIMIT 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            if (excludeTableId != null) {
                ps.setLong(2, excludeTableId);
            }
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public static void rename(Connection conn, long tableId, String name) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE loot_tables SET name = ? WHERE loot_table_id = ?")) {
            ps.setString(1, name);
            ps.setLong(2, tableId);
            ps.executeUpdate();
        }
    }

    public static void delete(Connection conn, long tableId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM loot_tables WHERE loot_table_id = ?")) {
            ps.setLong(1, tableId);
            ps.executeUpdate();
        }
    }

    public static boolean addEntry(Connection conn, long tableId, long itemId, int weight) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO loot_table_entries(loot_table_id, item_id, weight) VALUES(?, ?, ?)")) {
            ps.setLong(1, tableId);
            ps.setLong(2, itemId);
            ps.setInt(3, weight);
            return ps.executeUpdate() > 0;
        }
    }

    public static void removeEntry(Connection conn, long tableId, long itemId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM loot_table_entries WHERE loot_table_id = ? AND item_id = ?")) {
            ps.setLong(1, tableId);
            ps.setLong(2, itemId);
            ps.executeUpdate();
        }
    }

    public static void updateWeight(Connection conn, long tableId, long itemId, int weight) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE loot_table_entries SET weight = ? WHERE loot_table_id = ? AND item_id = ?")) {
            ps.setInt(1, weight);
            ps.setLong(2, tableId);
            ps.setLong(3, itemId);
            ps.executeUpdate();
        }
    }
}
