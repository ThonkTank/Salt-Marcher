package features.items.adapter.sqlite;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

final class ItemsSchema {

    static final String ENTRIES_TABLE = "items_catalog_entries";
    static final String TAGS_TABLE = "items_catalog_tags";

    private static final String PREDECESSOR_ENTRIES_TABLE = "items";
    private static final String PREDECESSOR_TAGS_TABLE = "item_tags";

    private static final List<String> LEGACY_ENTRY_COLUMNS = List.of(
            "id", "name", "slug", "category", "subcategory", "is_magic", "rarity",
            "requires_attunement", "attunement_condition", "cost", "cost_cp", "weight",
            "damage", "properties", "armor_class", "description", "source", "tags");
    private static final List<String> LEGACY_TAG_COLUMNS = List.of("item_id", "tag");
    private static final List<String> INTERMEDIATE_ENTRY_COLUMNS = List.of(
            "source_key", "name", "category", "subcategory", "magic", "rarity", "attunement",
            "cost_cp", "cost_display", "weight", "damage", "armor_class", "description",
            "source_version", "source_url");
    private static final List<String> INTERMEDIATE_TAG_COLUMNS = List.of("item_source_key", "tag");
    private static final List<String> TARGET_ENTRY_COLUMNS = List.of(
            "source_key", "legacy_id", "name", "category", "subcategory", "magic", "rarity",
            "attunement", "attunement_condition", "cost_cp", "cost_display", "weight", "damage",
            "armor_class", "description", "source_version", "source_url", "source_properties_text",
            "source_tags_text");
    private static final List<String> TARGET_TAG_COLUMNS = List.of("item_source_key", "tag");

    void migrateV1(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS items (
                        source_key TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        category TEXT NOT NULL,
                        subcategory TEXT NOT NULL DEFAULT '',
                        magic INTEGER NOT NULL CHECK (magic IN (0, 1)),
                        rarity TEXT NOT NULL DEFAULT '',
                        attunement INTEGER NOT NULL CHECK (attunement IN (0, 1)),
                        cost_cp INTEGER,
                        cost_display TEXT NOT NULL DEFAULT '',
                        weight REAL,
                        damage TEXT NOT NULL DEFAULT '',
                        armor_class TEXT NOT NULL DEFAULT '',
                        description TEXT NOT NULL DEFAULT '',
                        source_version TEXT NOT NULL,
                        source_url TEXT NOT NULL
                    )
                    """);
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS item_tags (
                        item_source_key TEXT NOT NULL,
                        tag TEXT NOT NULL,
                        PRIMARY KEY (item_source_key, tag),
                        FOREIGN KEY (item_source_key) REFERENCES items(source_key) ON DELETE CASCADE
                    )
                    """);
            statement.execute("CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_items_category ON items(category, subcategory)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_items_rarity ON items(rarity)");
            statement.execute("CREATE INDEX IF NOT EXISTS idx_items_cost ON items(cost_cp)");
        }
    }

    void migrateV2(Connection connection) throws SQLException {
        SourceShape shape = classify(connection);
        if (shape == SourceShape.TARGET) {
            validateTarget(connection);
            return;
        }
        validatePredecessor(connection, shape);
        int expectedEntries = count(connection, "SELECT COUNT(*) FROM " + PREDECESSOR_ENTRIES_TABLE);
        int expectedTags = count(connection, "SELECT COUNT(*) FROM " + PREDECESSOR_TAGS_TABLE);

        createTarget(connection);
        if (shape == SourceShape.LEGACY) {
            copyLegacy(connection);
        } else {
            copyIntermediate(connection);
        }
        assertCount(connection, ENTRIES_TABLE, expectedEntries);
        assertCount(connection, TAGS_TABLE, expectedTags);
        validateTargetRows(connection);
        dropPredecessor(connection);
        validateTarget(connection);
    }

    void validateTarget(Connection connection) throws SQLException {
        if (!tableExists(connection, ENTRIES_TABLE) || !tableExists(connection, TAGS_TABLE)
                || tableExists(connection, PREDECESSOR_ENTRIES_TABLE)
                || tableExists(connection, PREDECESSOR_TAGS_TABLE)) {
            throw incompatible();
        }
        requireColumns(connection, ENTRIES_TABLE, TARGET_ENTRY_COLUMNS);
        requireColumns(connection, TAGS_TABLE, TARGET_TAG_COLUMNS);
        requirePrimaryKey(connection, ENTRIES_TABLE, List.of("source_key"));
        requirePrimaryKey(connection, TAGS_TABLE, List.of("item_source_key", "tag"));
        requireForeignKey(connection, TAGS_TABLE, ENTRIES_TABLE, "item_source_key", "source_key");
        if (!hasUniqueIndex(connection, ENTRIES_TABLE, List.of("legacy_id"))) {
            throw incompatible();
        }
        validateTargetRows(connection);
    }

    private static SourceShape classify(Connection connection) throws SQLException {
        boolean predecessorEntries = tableExists(connection, PREDECESSOR_ENTRIES_TABLE);
        boolean predecessorTags = tableExists(connection, PREDECESSOR_TAGS_TABLE);
        boolean targetEntries = tableExists(connection, ENTRIES_TABLE);
        boolean targetTags = tableExists(connection, TAGS_TABLE);
        if (targetEntries && targetTags && !predecessorEntries && !predecessorTags) {
            requireColumns(connection, ENTRIES_TABLE, TARGET_ENTRY_COLUMNS);
            requireColumns(connection, TAGS_TABLE, TARGET_TAG_COLUMNS);
            return SourceShape.TARGET;
        }
        if (!targetEntries && !targetTags && predecessorEntries && predecessorTags) {
            List<String> entries = columns(connection, PREDECESSOR_ENTRIES_TABLE);
            List<String> tags = columns(connection, PREDECESSOR_TAGS_TABLE);
            if (entries.equals(LEGACY_ENTRY_COLUMNS) && tags.equals(LEGACY_TAG_COLUMNS)) {
                requirePrimaryKey(connection, PREDECESSOR_ENTRIES_TABLE, List.of("id"));
                requirePrimaryKey(connection, PREDECESSOR_TAGS_TABLE, List.of("item_id", "tag"));
                requireForeignKey(
                        connection, PREDECESSOR_TAGS_TABLE, PREDECESSOR_ENTRIES_TABLE, "item_id", "id");
                return SourceShape.LEGACY;
            }
            if (entries.equals(INTERMEDIATE_ENTRY_COLUMNS) && tags.equals(INTERMEDIATE_TAG_COLUMNS)) {
                requirePrimaryKey(connection, PREDECESSOR_ENTRIES_TABLE, List.of("source_key"));
                requirePrimaryKey(
                        connection, PREDECESSOR_TAGS_TABLE, List.of("item_source_key", "tag"));
                requireForeignKey(
                        connection,
                        PREDECESSOR_TAGS_TABLE,
                        PREDECESSOR_ENTRIES_TABLE,
                        "item_source_key",
                        "source_key");
                return SourceShape.INTERMEDIATE;
            }
        }
        throw incompatible();
    }

    private static void validatePredecessor(Connection connection, SourceShape shape) throws SQLException {
        if (shape == SourceShape.LEGACY) {
            requireNoRows(connection, """
                    SELECT 1 FROM items
                    WHERE slug IS NULL OR TRIM(slug) = ''
                       OR name IS NULL OR TRIM(name) = ''
                       OR is_magic NOT IN (0, 1)
                       OR requires_attunement NOT IN (0, 1)
                    LIMIT 1
                    """);
            requireNoRows(connection, """
                    SELECT 1 FROM items GROUP BY slug HAVING COUNT(*) > 1 LIMIT 1
                    """);
            requireNoRows(connection, """
                    SELECT 1 FROM item_tags tag
                    LEFT JOIN items item ON item.id = tag.item_id
                    WHERE item.id IS NULL LIMIT 1
                    """);
            return;
        }
        requireNoRows(connection, """
                SELECT 1 FROM items
                WHERE source_key IS NULL OR TRIM(source_key) = ''
                   OR name IS NULL OR TRIM(name) = ''
                   OR category IS NULL OR magic NOT IN (0, 1) OR attunement NOT IN (0, 1)
                LIMIT 1
                """);
        requireNoRows(connection, """
                SELECT 1 FROM item_tags tag
                LEFT JOIN items item ON item.source_key = tag.item_source_key
                WHERE item.source_key IS NULL LIMIT 1
                """);
    }

    private static void createTarget(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE items_catalog_entries (
                        source_key TEXT PRIMARY KEY,
                        legacy_id INTEGER UNIQUE,
                        name TEXT NOT NULL,
                        category TEXT NOT NULL,
                        subcategory TEXT NOT NULL DEFAULT '',
                        magic INTEGER NOT NULL CHECK (magic IN (0, 1)),
                        rarity TEXT NOT NULL DEFAULT '',
                        attunement INTEGER NOT NULL CHECK (attunement IN (0, 1)),
                        attunement_condition TEXT NOT NULL DEFAULT '',
                        cost_cp INTEGER,
                        cost_display TEXT NOT NULL DEFAULT '',
                        weight REAL,
                        damage TEXT NOT NULL DEFAULT '',
                        armor_class TEXT NOT NULL DEFAULT '',
                        description TEXT NOT NULL DEFAULT '',
                        source_version TEXT NOT NULL DEFAULT '',
                        source_url TEXT NOT NULL DEFAULT '',
                        source_properties_text TEXT NOT NULL DEFAULT '',
                        source_tags_text TEXT NOT NULL DEFAULT ''
                    )
                    """);
            statement.execute("""
                    CREATE TABLE items_catalog_tags (
                        item_source_key TEXT NOT NULL,
                        tag TEXT NOT NULL,
                        PRIMARY KEY (item_source_key, tag),
                        FOREIGN KEY (item_source_key)
                            REFERENCES items_catalog_entries(source_key) ON DELETE CASCADE
                    )
                    """);
            statement.execute("CREATE INDEX idx_items_catalog_name ON items_catalog_entries(name)");
            statement.execute("CREATE INDEX idx_items_catalog_category "
                    + "ON items_catalog_entries(category, subcategory)");
            statement.execute("CREATE INDEX idx_items_catalog_rarity ON items_catalog_entries(rarity)");
            statement.execute("CREATE INDEX idx_items_catalog_cost ON items_catalog_entries(cost_cp)");
            statement.execute("CREATE INDEX idx_items_catalog_tag ON items_catalog_tags(tag)");
        }
    }

    private static void copyLegacy(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO items_catalog_entries(
                        source_key, legacy_id, name, category, subcategory, magic, rarity, attunement,
                        attunement_condition, cost_cp, cost_display, weight, damage, armor_class,
                        description, source_version, source_url, source_properties_text, source_tags_text)
                    SELECT 'legacy:' || slug, id, name, COALESCE(category, ''), COALESCE(subcategory, ''),
                        COALESCE(is_magic, 0), COALESCE(rarity, ''), COALESCE(requires_attunement, 0),
                        COALESCE(attunement_condition, ''), cost_cp, COALESCE(cost, ''), weight,
                        COALESCE(damage, ''), COALESCE(armor_class, ''), COALESCE(description, ''),
                        COALESCE(source, ''), '', COALESCE(properties, ''), COALESCE(tags, '')
                    FROM items
                    """);
            statement.executeUpdate("""
                    INSERT INTO items_catalog_tags(item_source_key, tag)
                    SELECT 'legacy:' || item.slug, tag.tag
                    FROM item_tags tag JOIN items item ON item.id = tag.item_id
                    """);
        }
    }

    private static void copyIntermediate(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO items_catalog_entries(
                        source_key, legacy_id, name, category, subcategory, magic, rarity, attunement,
                        attunement_condition, cost_cp, cost_display, weight, damage, armor_class,
                        description, source_version, source_url, source_properties_text, source_tags_text)
                    SELECT source_key, NULL, name, category, subcategory, magic, rarity, attunement,
                        '', cost_cp, cost_display, weight, damage, armor_class, description,
                        source_version, source_url, '', ''
                    FROM items
                    """);
            statement.executeUpdate("""
                    INSERT INTO items_catalog_tags(item_source_key, tag)
                    SELECT item_source_key, tag FROM item_tags
                    """);
        }
    }

    private static void dropPredecessor(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE item_tags");
            statement.execute("DROP TABLE items");
        }
    }

    private static void validateTargetRows(Connection connection) throws SQLException {
        requireNoRows(connection, """
                SELECT 1 FROM items_catalog_entries
                WHERE source_key IS NULL OR TRIM(source_key) = ''
                   OR name IS NULL OR TRIM(name) = '' OR category IS NULL
                   OR magic NOT IN (0, 1) OR attunement NOT IN (0, 1)
                LIMIT 1
                """);
        requireNoRows(connection, """
                SELECT 1 FROM items_catalog_tags tag
                LEFT JOIN items_catalog_entries item ON item.source_key = tag.item_source_key
                WHERE item.source_key IS NULL LIMIT 1
                """);
    }

    private static void requireColumns(Connection connection, String table, List<String> expected)
            throws SQLException {
        if (!columns(connection, table).equals(expected)) {
            throw incompatible();
        }
    }

    private static List<String> columns(Connection connection, String table) throws SQLException {
        List<String> names = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (result.next()) {
                names.add(result.getString("name"));
            }
        }
        return List.copyOf(names);
    }

    private static void requirePrimaryKey(Connection connection, String table, List<String> expected)
            throws SQLException {
        List<PrimaryKeyColumn> columns = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (result.next()) {
                int position = result.getInt("pk");
                if (position > 0) {
                    columns.add(new PrimaryKeyColumn(position, result.getString("name")));
                }
            }
        }
        columns.sort(java.util.Comparator.comparingInt(PrimaryKeyColumn::position));
        if (!columns.stream().map(PrimaryKeyColumn::name).toList().equals(expected)) {
            throw incompatible();
        }
    }

    private static void requireForeignKey(
            Connection connection,
            String table,
            String targetTable,
            String sourceColumn,
            String targetColumn
    ) throws SQLException {
        List<ForeignKey> keys = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA foreign_key_list(" + table + ")")) {
            while (result.next()) {
                keys.add(new ForeignKey(
                        result.getString("table"),
                        result.getString("from"),
                        result.getString("to"),
                        result.getString("on_delete")));
            }
        }
        if (!keys.equals(List.of(new ForeignKey(targetTable, sourceColumn, targetColumn, "CASCADE")))) {
            throw incompatible();
        }
    }

    private static boolean hasUniqueIndex(Connection connection, String table, List<String> expectedColumns)
            throws SQLException {
        List<String> uniqueIndexes = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA index_list(" + table + ")")) {
            while (result.next()) {
                if (result.getInt("unique") == 1) {
                    uniqueIndexes.add(result.getString("name"));
                }
            }
        }
        for (String index : uniqueIndexes) {
            List<String> indexedColumns = new ArrayList<>();
            try (Statement statement = connection.createStatement();
                 ResultSet result = statement.executeQuery("PRAGMA index_info('" + index + "')")) {
                while (result.next()) {
                    indexedColumns.add(result.getString("name"));
                }
            }
            if (indexedColumns.equals(expectedColumns)) {
                return true;
            }
        }
        return false;
    }

    private static boolean tableExists(Connection connection, String table) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, table);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private static void requireNoRows(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            if (result.next()) {
                throw incompatible();
            }
        }
    }

    private static int count(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            return result.next() ? result.getInt(1) : 0;
        }
    }

    private static void assertCount(Connection connection, String table, int expected) throws SQLException {
        if (count(connection, "SELECT COUNT(*) FROM " + table) != expected) {
            throw incompatible();
        }
    }

    private static SQLException incompatible() {
        return new SQLException("Unsupported Items schema signature.");
    }

    private enum SourceShape {
        LEGACY,
        INTERMEDIATE,
        TARGET
    }

    private record PrimaryKeyColumn(int position, String name) { }

    private record ForeignKey(String table, String sourceColumn, String targetColumn, String onDelete) { }
}
