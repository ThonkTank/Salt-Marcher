package features.items.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

import features.items.model.Item;

public final class ItemRepository {

    private ItemRepository() {
        throw new AssertionError("No instances");
    }

    // -------------------------------------------------------------------------
    // SQL constants
    // -------------------------------------------------------------------------

    private static final String ITEM_INSERT_SQL = "INSERT OR REPLACE INTO items("
            + "id, name, slug, category, subcategory, is_magic,"
            + "rarity, requires_attunement, attunement_condition,"
            + "cost, cost_cp, weight, damage, properties, armor_class,"
            + "description, source"
            + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    private static final String ITEM_TAG_INSERT_SQL =
            "INSERT OR IGNORE INTO item_tags(item_id, tag) VALUES(?, ?)";

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private static Item mapRow(ResultSet rs) throws SQLException {
        Item i = new Item();
        i.Id                  = rs.getLong("id");
        i.Name                = rs.getString("name");
        i.Slug                = rs.getString("slug");
        i.Category            = rs.getString("category");
        i.Subcategory         = rs.getString("subcategory");
        i.IsMagic             = rs.getInt("is_magic") != 0;
        i.Rarity              = rs.getString("rarity");
        i.RequiresAttunement  = rs.getInt("requires_attunement") != 0;
        i.AttunementCondition = rs.getString("attunement_condition");
        i.Cost                = rs.getString("cost");
        i.CostCp              = rs.getInt("cost_cp");
        i.Weight              = rs.getDouble("weight");
        i.Damage              = rs.getString("damage");
        i.Properties          = rs.getString("properties");
        i.ArmorClass          = rs.getString("armor_class");
        i.Description         = rs.getString("description");
        i.Source              = rs.getString("source");
        i.Tags                = new ArrayList<>();
        return i;
    }

    private static void loadTags(Connection conn, List<Item> items) throws SQLException {
        if (items.isEmpty()) return;
        Map<Long, Item> byId = new HashMap<>(items.size() * 2);
        for (Item i : items) byId.put(i.Id, i);
        String sql = "SELECT item_id, tag FROM item_tags WHERE item_id IN ("
                + String.join(",", Collections.nCopies(items.size(), "?")) + ")";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (Item i : items) ps.setLong(idx++, i.Id);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Item item = byId.get(rs.getLong("item_id"));
                    if (item == null) continue;
                    addUniqueTag(item.Tags, rs.getString("tag"));
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Save
    // -------------------------------------------------------------------------

    /**
     * Saves an item and its tags within an open bulk-import connection.
     * Caller must have set {@code autoCommit(false)} before calling.
     */
    public static void save(Item item, Connection conn) throws SQLException {
        try (PreparedStatement itemPs = conn.prepareStatement(ITEM_INSERT_SQL)) {
            saveInternal(item, itemPs, conn);
        }
    }

    private static void saveInternal(Item item, PreparedStatement itemPs, Connection conn) throws SQLException {
        List<String> normalizedTags = normalizeTags(item.Tags);

        // Clear existing tags first (INSERT OR REPLACE on items row does not cascade-delete tags
        // without PRAGMA foreign_keys=ON, so we handle it explicitly).
        try (PreparedStatement del = conn.prepareStatement("DELETE FROM item_tags WHERE item_id = ?")) {
            del.setLong(1, item.Id);
            del.executeUpdate();
        }
        bindItemParams(itemPs, item);
        itemPs.executeUpdate();
        if (!normalizedTags.isEmpty()) {
            try (PreparedStatement tagPs = conn.prepareStatement(ITEM_TAG_INSERT_SQL)) {
                for (String tag : normalizedTags) {
                    tagPs.setLong(1, item.Id);
                    tagPs.setString(2, tag);
                    tagPs.addBatch();
                }
                tagPs.executeBatch();
            }
        }
    }

    private static void bindItemParams(PreparedStatement ps, Item i) throws SQLException {
        ps.clearParameters();
        ps.setLong   (1,  i.Id);
        ps.setString (2,  i.Name);
        ps.setString (3,  i.Slug);
        ps.setString (4,  i.Category);
        ps.setString (5,  i.Subcategory);
        ps.setInt    (6,  i.IsMagic ? 1 : 0);
        ps.setString (7,  i.Rarity);
        ps.setInt    (8,  i.RequiresAttunement ? 1 : 0);
        ps.setString (9,  i.AttunementCondition);
        ps.setString (10, i.Cost);
        ps.setInt    (11, i.CostCp);
        ps.setDouble (12, i.Weight);
        ps.setString (13, i.Damage);
        ps.setString (14, i.Properties);
        ps.setString (15, i.ArmorClass);
        ps.setString (16, i.Description);
        ps.setString (17, i.Source);
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    public static Item getItem(Connection conn, Long id) throws SQLException {
        String sql = "SELECT * FROM items WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            Item item = null;
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) item = mapRow(rs);
            }
            if (item != null) loadTags(conn, List.of(item));
            return item;
        }
    }

    public static List<Item> searchByName(Connection conn, String query, int limit) throws SQLException {
        List<Item> items = new ArrayList<>();
        String sql = "SELECT * FROM items WHERE LOWER(name) LIKE LOWER(?) LIMIT ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, "%" + query + "%");
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) items.add(mapRow(rs));
            }
            loadTags(conn, items);
        }
        return items;
    }

    public static List<Item> getItemsByCategory(Connection conn, String category) throws SQLException {
        List<Item> items = new ArrayList<>();
        String sql = "SELECT * FROM items WHERE LOWER(category) = LOWER(?) ORDER BY name";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, category);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) items.add(mapRow(rs));
            }
            loadTags(conn, items);
        }
        return items;
    }

    public static List<Item> getMagicItemsByRarity(Connection conn, String rarity) throws SQLException {
        List<Item> items = new ArrayList<>();
        String sql = "SELECT * FROM items WHERE is_magic = 1 AND LOWER(rarity) = LOWER(?) ORDER BY name";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, rarity);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) items.add(mapRow(rs));
            }
            loadTags(conn, items);
        }
        return items;
    }

    private static List<String> normalizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) return List.of();
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String raw : tags) {
            if (raw == null) continue;
            String trimmed = raw.trim();
            if (trimmed.isEmpty()) continue;
            normalized.add(trimmed);
        }
        return new ArrayList<>(normalized);
    }

    private static void addUniqueTag(List<String> tags, String rawTag) {
        if (rawTag == null) return;
        String normalized = rawTag.trim();
        if (normalized.isEmpty()) return;
        if (!tags.contains(normalized)) tags.add(normalized);
    }
}
