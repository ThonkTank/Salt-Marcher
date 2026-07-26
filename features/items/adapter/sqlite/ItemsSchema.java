package features.items.adapter.sqlite;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

/** Direct initializer for the only supported Items schema. */
final class ItemsSchema {

    static final String ENTRIES_TABLE = "items_catalog_entries";
    static final String TAGS_TABLE = "items_catalog_tags";

    private static final List<String> RETIRED_DEVELOPMENT_TABLES = List.of("items", "item_tags");
    static final List<String> CREATE_TABLE_SQL = List.of(
            """
                    CREATE TABLE items_catalog_entries (
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
                    """,
            """
                    CREATE TABLE items_catalog_tags (
                        item_source_key TEXT NOT NULL,
                        tag TEXT NOT NULL,
                        PRIMARY KEY (item_source_key, tag),
                        FOREIGN KEY (item_source_key)
                            REFERENCES items_catalog_entries(source_key) ON DELETE CASCADE
                    )
                    """);
    static final List<String> CREATE_INDEX_SQL = List.of(
            "CREATE INDEX idx_items_catalog_name ON items_catalog_entries(name)",
            "CREATE INDEX idx_items_catalog_category ON items_catalog_entries(category, subcategory)",
            "CREATE INDEX idx_items_catalog_rarity ON items_catalog_entries(rarity)",
            "CREATE INDEX idx_items_catalog_cost ON items_catalog_entries(cost_cp)",
            "CREATE INDEX idx_items_catalog_tag ON items_catalog_tags(tag)");

    void initializeCurrent(Connection connection) throws SQLException {
        requireUninitialized(connection);
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
            for (String createIndexSql : CREATE_INDEX_SQL) {
                statement.execute(createIndexSql);
            }
        }
    }

    void rejectRetiredDevelopmentTables(Connection connection) throws SQLException {
        for (String table : RETIRED_DEVELOPMENT_TABLES) {
            if (tableExists(connection, table)) {
                throw incompatible();
            }
        }
    }

    private static void requireUninitialized(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master "
                             + "WHERE type IN ('table', 'index', 'view', 'trigger') "
                             + "AND (name GLOB 'items_catalog_*' OR name IN ('items', 'item_tags')) LIMIT 1")) {
            if (result.next()) {
                throw incompatible();
            }
        }
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

    private static SQLException incompatible() {
        return new SQLException("Unsupported Items development schema; reinitialize and import the current catalog.");
    }
}
