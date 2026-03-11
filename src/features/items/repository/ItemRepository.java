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
import java.util.Locale;

import features.items.model.Item;

public final class ItemRepository {

    public record SearchResult(List<Item> items, int totalCount) {}
    @FunctionalInterface
    private interface SqlBinder {
        void bind(PreparedStatement ps, int index) throws SQLException;
    }

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

    public static SearchResult searchWithFiltersAndCount(
            Connection conn,
            String nameQuery,
            Integer costMinCp,
            Integer costMaxCp,
            boolean magicOnly,
            boolean attunementOnly,
            List<String> categories,
            List<String> subcategories,
            List<String> rarities,
            List<String> sources,
            List<String> tags,
            List<Long> excludeIds,
            String sortColumn,
            String sortDirection,
            int limit,
            int offset) throws SQLException {
        List<SqlBinder> binders = new ArrayList<>();
        String whereClause = buildSearchWhereClause(
                binders,
                nameQuery,
                costMinCp,
                costMaxCp,
                magicOnly,
                attunementOnly,
                categories,
                subcategories,
                rarities,
                sources,
                tags,
                excludeIds);

        String orderBy = resolveOrderBy(sortColumn, sortDirection);
        String pageSql = "SELECT * FROM items" + whereClause + orderBy + " LIMIT ? OFFSET ?";
        List<Item> items = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(pageSql)) {
            bindParams(ps, binders);
            int nextIndex = binders.size() + 1;
            ps.setInt(nextIndex++, Math.max(1, limit));
            ps.setInt(nextIndex, Math.max(0, offset));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) items.add(mapRow(rs));
            }
        }
        loadTags(conn, items);

        String countSql = "SELECT COUNT(*) FROM items" + whereClause;
        int totalCount = 0;
        try (PreparedStatement ps = conn.prepareStatement(countSql)) {
            bindParams(ps, binders);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) totalCount = rs.getInt(1);
            }
        }
        return new SearchResult(items, totalCount);
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

    public static List<String> getDistinctCategories(Connection conn) throws SQLException {
        return getDistinctColumnValues(conn, "items", "category");
    }

    public static List<String> getDistinctSubcategories(Connection conn) throws SQLException {
        return getDistinctColumnValues(conn, "items", "subcategory");
    }

    public static List<String> getDistinctRarities(Connection conn) throws SQLException {
        return getDistinctColumnValues(conn, "items", "rarity");
    }

    public static List<String> getDistinctSources(Connection conn) throws SQLException {
        return getDistinctColumnValues(conn, "items", "source");
    }

    public static List<String> getDistinctTags(Connection conn) throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT tag FROM item_tags WHERE tag IS NOT NULL AND TRIM(tag) <> '' ORDER BY LOWER(tag), tag";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) values.add(rs.getString(1));
        }
        return values;
    }

    private static String buildSearchWhereClause(
            List<SqlBinder> binders,
            String nameQuery,
            Integer costMinCp,
            Integer costMaxCp,
            boolean magicOnly,
            boolean attunementOnly,
            List<String> categories,
            List<String> subcategories,
            List<String> rarities,
            List<String> sources,
            List<String> tags,
            List<Long> excludeIds) {
        List<String> clauses = new ArrayList<>();
        if (nameQuery != null && !nameQuery.isBlank()) {
            clauses.add("LOWER(name) LIKE LOWER(?)");
            binders.add((ps, index) -> ps.setString(index, "%" + nameQuery.trim() + "%"));
        }
        if (costMinCp != null) {
            clauses.add("cost_cp >= ?");
            binders.add((ps, index) -> ps.setInt(index, costMinCp));
        }
        if (costMaxCp != null) {
            clauses.add("cost_cp <= ?");
            binders.add((ps, index) -> ps.setInt(index, costMaxCp));
        }
        if (magicOnly) clauses.add("is_magic = 1");
        if (attunementOnly) clauses.add("requires_attunement = 1");
        addCaseInsensitiveInClause(clauses, binders, "category", categories);
        addCaseInsensitiveInClause(clauses, binders, "subcategory", subcategories);
        addCaseInsensitiveInClause(clauses, binders, "rarity", rarities);
        addCaseInsensitiveInClause(clauses, binders, "source", sources);
        if (tags != null && !tags.isEmpty()) {
            clauses.add("EXISTS (SELECT 1 FROM item_tags tag_filter WHERE tag_filter.item_id = items.id AND LOWER(tag_filter.tag) IN ("
                    + placeholders(tags.size()) + "))");
            for (String tag : tags) {
                String normalized = tag == null ? "" : tag.trim().toLowerCase(Locale.ROOT);
                binders.add((ps, index) -> ps.setString(index, normalized));
            }
        }
        if (excludeIds != null && !excludeIds.isEmpty()) {
            List<Long> validExcludeIds = excludeIds.stream()
                    .filter(java.util.Objects::nonNull)
                    .toList();
            if (!validExcludeIds.isEmpty()) {
                clauses.add("id NOT IN (" + placeholders(validExcludeIds.size()) + ")");
                for (Long excludeId : validExcludeIds) {
                    binders.add((ps, index) -> ps.setLong(index, excludeId));
                }
            }
        }
        return clauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", clauses);
    }

    private static void addCaseInsensitiveInClause(
            List<String> clauses,
            List<SqlBinder> binders,
            String column,
            List<String> values) {
        if (values == null || values.isEmpty()) return;
        clauses.add("LOWER(" + column + ") IN (" + placeholders(values.size()) + ")");
        for (String value : values) {
            String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
            binders.add((ps, index) -> ps.setString(index, normalized));
        }
    }

    private static void bindParams(PreparedStatement ps, List<SqlBinder> binders) throws SQLException {
        for (int i = 0; i < binders.size(); i++) {
            binders.get(i).bind(ps, i + 1);
        }
    }

    private static String resolveOrderBy(String sortColumn, String sortDirection) {
        String dir = "DESC".equalsIgnoreCase(sortDirection) ? "DESC" : "ASC";
        String column = sortColumn == null ? "name" : sortColumn.toLowerCase(Locale.ROOT);
        String orderExpr = switch (column) {
            case "cost_cp" -> "cost_cp";
            case "category" -> "LOWER(category)";
            default -> "LOWER(name)";
        };
        return " ORDER BY " + orderExpr + " " + dir + ", LOWER(name) ASC";
    }

    private static String placeholders(int count) {
        return String.join(",", Collections.nCopies(Math.max(1, count), "?"));
    }

    private static List<String> getDistinctColumnValues(Connection conn, String table, String column) throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM " + table
                + " WHERE " + column + " IS NOT NULL AND TRIM(" + column + ") <> ''"
                + " ORDER BY LOWER(" + column + "), " + column;
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) values.add(rs.getString(1));
        }
        return values;
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
