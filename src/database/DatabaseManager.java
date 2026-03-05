package database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public class DatabaseManager {

    private static final String URL = "jdbc:sqlite:game.db";

    /**
     * Opens and returns a fresh JDBC connection with base PRAGMAs applied.
     * Each caller is responsible for closing it (try-with-resources is fine).
     * SQLite WAL mode handles file-level concurrency across multiple connections.
     */
    public static Connection getConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(URL);
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA foreign_keys = ON");
            stmt.execute("PRAGMA journal_mode = WAL");
        } catch (SQLException e) {
            conn.close();
            throw e;
        }
        return conn;
    }

    /**
     * Optimizes the SQLite session for bulk imports.
     * Call only from standalone CLI importer processes; these settings are scoped
     * to {@code conn} and are reset by {@link #resetBulkImportPragmas(Connection)}.
     */
    public static void applyBulkImportPragmas(Connection conn) throws SQLException {
        assert !Thread.currentThread().getName().startsWith("JavaFX")
                : "applyBulkImportPragmas must not be called from the JavaFX app process";
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA journal_mode = WAL");
            stmt.execute("PRAGMA synchronous = NORMAL");
            stmt.execute("PRAGMA cache_size = -64000");
        }
    }

    /**
     * Restores conservative durability settings after a bulk import.
     * Call in a finally block after {@link #applyBulkImportPragmas(Connection)}.
     */
    public static void resetBulkImportPragmas(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA synchronous = FULL");
            stmt.execute("PRAGMA cache_size = -2000");
        }
    }

    public static void setupDatabase() {
        String playersSql = "CREATE TABLE IF NOT EXISTS player_characters ("
                + "id       INTEGER PRIMARY KEY,"
                + "name     TEXT    NOT NULL,"
                + "level    INTEGER NOT NULL DEFAULT 1,"
                + "in_party INTEGER NOT NULL DEFAULT 1"
                + ")";

        String creaturesSql = "CREATE TABLE IF NOT EXISTS creatures ("
                + "id                     INTEGER PRIMARY KEY,"
                + "name                   TEXT    NOT NULL,"
                + "size                   TEXT,"
                + "creature_type          TEXT,"
                + "alignment              TEXT,"
                + "cr                     TEXT,"
                + "xp                     INTEGER DEFAULT 0,"
                + "hp                     INTEGER DEFAULT 0,"
                + "hit_dice               TEXT,"
                + "ac                     INTEGER DEFAULT 10,"
                + "ac_notes               TEXT,"
                + "speed                  INTEGER DEFAULT 0,"
                + "fly_speed              INTEGER DEFAULT 0,"
                + "swim_speed             INTEGER DEFAULT 0,"
                + "climb_speed            INTEGER DEFAULT 0,"
                + "burrow_speed           INTEGER DEFAULT 0,"
                + "str                    INTEGER DEFAULT 10,"
                + "dex                    INTEGER DEFAULT 10,"
                + "con                    INTEGER DEFAULT 10,"
                + "intel                  INTEGER DEFAULT 10,"
                + "wis                    INTEGER DEFAULT 10,"
                + "cha                    INTEGER DEFAULT 10,"
                + "initiative_bonus       INTEGER DEFAULT 0,"
                + "proficiency_bonus      INTEGER DEFAULT 2,"
                + "saving_throws          TEXT,"
                + "skills                 TEXT,"
                + "damage_vulnerabilities TEXT,"
                + "damage_resistances     TEXT,"
                + "damage_immunities      TEXT,"
                + "condition_immunities   TEXT,"
                + "senses                 TEXT,"
                + "passive_perception     INTEGER DEFAULT 10,"
                + "languages              TEXT,"
                + "legendary_action_count INTEGER DEFAULT 0,"
                + "role                   TEXT"
                + ")";

        String actionsSql = "CREATE TABLE IF NOT EXISTS creature_actions ("
                + "id          INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                + "action_type TEXT    NOT NULL DEFAULT 'action',"
                + "name        TEXT,"
                + "description TEXT"
                + ")";

        String itemsSql = "CREATE TABLE IF NOT EXISTS items ("
                + "id                   INTEGER PRIMARY KEY,"
                + "name                 TEXT    NOT NULL,"
                + "slug                 TEXT,"
                + "category             TEXT,"
                + "subcategory          TEXT,"
                + "is_magic             INTEGER DEFAULT 0,"
                + "rarity               TEXT,"
                + "requires_attunement  INTEGER DEFAULT 0,"
                + "attunement_condition TEXT,"
                + "cost                 TEXT,"
                + "cost_cp              INTEGER DEFAULT 0,"
                + "weight               REAL    DEFAULT 0.0,"
                + "damage               TEXT,"
                + "properties           TEXT,"
                + "armor_class          TEXT,"
                + "description          TEXT,"
                + "source               TEXT,"
                + "tags                 TEXT DEFAULT ''"
                + ")";

        String itemTagsSql = "CREATE TABLE IF NOT EXISTS item_tags ("
                + "item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,"
                + "tag     TEXT    NOT NULL,"
                + "PRIMARY KEY (item_id, tag)"
                + ")";

        String creatureBiomesSql = "CREATE TABLE IF NOT EXISTS creature_biomes ("
                + "creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                + "biome       TEXT    NOT NULL,"
                + "PRIMARY KEY (creature_id, biome)"
                + ")";

        String creatureSubtypesSql = "CREATE TABLE IF NOT EXISTS creature_subtypes ("
                + "creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                + "subtype     TEXT    NOT NULL,"
                + "PRIMARY KEY (creature_id, subtype)"
                + ")";

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {

            stmt.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)");

            stmt.execute(playersSql);
            stmt.execute(creaturesSql);
            stmt.execute(actionsSql);
            stmt.execute(itemsSql);
            stmt.execute(itemTagsSql);
            stmt.execute(creatureBiomesSql);
            stmt.execute(creatureSubtypesSql);

            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creatures_xp ON creatures(xp)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creatures_type ON creatures(creature_type)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_actions_creature_id ON creature_actions(creature_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_items_rarity ON items(rarity)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_items_is_magic ON items(is_magic)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creatures_size ON creatures(size)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creatures_alignment ON creatures(alignment)");
            // Note: no name index — all name queries use leading-wildcard LIKE which cannot use B-tree indexes
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_biomes_biome ON creature_biomes(biome)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_subtypes_subtype ON creature_subtypes(subtype)");

            int version = getSchemaVersion(conn);

            // v1: add in_party column to player_characters
            if (version < 1) {
                migratePartyColumn(conn);
                setSchemaVersion(conn, 1);
            }
            // v2: migrate biomes column to creature_biomes junction table
            if (version < 2) {
                migrateBiomes(conn);
                setSchemaVersion(conn, 2);
            }
            // v3: migrate subtype column to creature_subtypes junction table
            if (version < 3) {
                migrateSubtypes(conn);
                setSchemaVersion(conn, 3);
            }
            // v4: migrate tags column to item_tags junction table
            if (version < 4) {
                migrateItemTags(conn);
                setSchemaVersion(conn, 4);
            }
            // v5: drop legacy subtype and biomes columns (data now exclusively in junction tables)
            if (version < 5) {
                dropLegacyCreatureColumns(conn);
                setSchemaVersion(conn, 5);
            }
            // v6: add role column for pre-computed tactical role (avoids loading action text in encounter generation)
            if (version < 6) {
                migrateRoleColumn(conn);
                setSchemaVersion(conn, 6);
            }

        } catch (SQLException e) {
            throw new RuntimeException("Datenbankschema konnte nicht erstellt werden", e);
        }
    }

    private static int getSchemaVersion(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT value FROM meta WHERE key='schema_version'")) {
            if (rs.next()) {
                return Integer.parseInt(rs.getString(1));
            }
        }
        return 0;
    }

    private static void setSchemaVersion(Connection conn, int version) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT OR REPLACE INTO meta(key, value) VALUES('schema_version', ?)")) {
            ps.setString(1, String.valueOf(version));
            ps.executeUpdate();
        }
    }

    private static void migratePartyColumn(Connection conn) {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE player_characters ADD COLUMN in_party INTEGER NOT NULL DEFAULT 1");
        } catch (SQLException e) {
            // SQLite returns error when column already exists — normal when upgrading from pre-meta schema
            if (!e.getMessage().contains("duplicate column name")) {
                System.err.println("DatabaseManager.migratePartyColumn(): " + e.getMessage());
            }
        }
    }

    private static void migrateSubtypes(Connection conn) {
        migrateDelimitedColumn(conn, "subtype", "creature_subtypes", "subtype", "Subtype-Migration");
    }

    private static void migrateBiomes(Connection conn) {
        migrateDelimitedColumn(conn, "biomes", "creature_biomes", "biome", "Biome-Migration");
    }

    private static void migrateItemTags(Connection conn) {
        try {
            conn.setAutoCommit(false);
            try (var rs = conn.createStatement().executeQuery(
                        "SELECT id, tags FROM items WHERE tags IS NOT NULL AND tags != ''");
                 var ins = conn.prepareStatement(
                        "INSERT OR IGNORE INTO item_tags(item_id, tag) VALUES(?, ?)")) {
                while (rs.next()) {
                    long id = rs.getLong("id");
                    for (String val : rs.getString("tags").split(",")) {
                        String trimmed = val.trim();
                        if (!trimmed.isEmpty()) {
                            ins.setLong(1, id);
                            ins.setString(2, trimmed);
                            ins.addBatch();
                        }
                    }
                }
                ins.executeBatch();
            }
            conn.commit();
        } catch (SQLException e) {
            try { conn.rollback(); } catch (SQLException ignored) {}
            System.err.println("DatabaseManager.migrateItemTags(): " + e.getMessage());
        } finally {
            try { conn.setAutoCommit(true); } catch (SQLException ignored) {}
        }
    }

    private static final java.util.Set<String> MIGRATION_ALLOWED =
            java.util.Set.of("subtype:creature_subtypes:subtype", "biomes:creature_biomes:biome");

    private static void migrateRoleColumn(Connection conn) {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE creatures ADD COLUMN role TEXT");
        } catch (SQLException e) {
            if (!e.getMessage().contains("duplicate column name")) {
                System.err.println("DatabaseManager.migrateRoleColumn(): " + e.getMessage());
            }
        }
    }

    private static void dropLegacyCreatureColumns(Connection conn) {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE creatures DROP COLUMN subtype");
        } catch (SQLException e) {
            if (!e.getMessage().contains("no such column")) {
                System.err.println("DatabaseManager.dropLegacyCreatureColumns(): " + e.getMessage());
            }
        }
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE creatures DROP COLUMN biomes");
        } catch (SQLException e) {
            if (!e.getMessage().contains("no such column")) {
                System.err.println("DatabaseManager.dropLegacyCreatureColumns(): " + e.getMessage());
            }
        }
    }

    private static void migrateDelimitedColumn(Connection conn, String sourceColumn,
                                               String targetTable, String targetColumn, String label) {
        String key = sourceColumn + ":" + targetTable + ":" + targetColumn;
        if (!MIGRATION_ALLOWED.contains(key))
            throw new IllegalArgumentException("Invalid migration params: " + key);

        try (Statement stmt = conn.createStatement()) {
            conn.setAutoCommit(false);
            try {
                try (var rs = stmt.executeQuery(
                        "SELECT id, " + sourceColumn + " FROM creatures WHERE " + sourceColumn + " IS NOT NULL AND " + sourceColumn + " != ''");
                     var ins = conn.prepareStatement(
                        "INSERT OR IGNORE INTO " + targetTable + "(creature_id, " + targetColumn + ") VALUES(?, ?)")) {
                    while (rs.next()) {
                        long id = rs.getLong("id");
                        String raw = rs.getString(sourceColumn);
                        for (String val : raw.split(",")) {
                            String trimmed = val.trim();
                            if (!trimmed.isEmpty()) {
                                ins.setLong(1, id);
                                ins.setString(2, trimmed);
                                ins.addBatch();
                            }
                        }
                    }
                    ins.executeBatch();
                }
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                try { conn.setAutoCommit(true); } catch (SQLException ignored) {}
            }
        } catch (SQLException e) {
            System.err.println("DatabaseManager.migrateDelimitedColumn(" + label + "): " + e.getMessage());
        }
    }
}
