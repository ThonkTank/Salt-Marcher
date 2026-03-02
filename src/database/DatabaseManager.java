package database;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

public class DatabaseManager {

    private static final String URL = "jdbc:sqlite:game.db";

    private static Connection realConnection;

    static {
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("SQLite JDBC Treiber nicht gefunden", e);
        }

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                if (realConnection != null && !realConnection.isClosed()) {
                    realConnection.close();
                }
            } catch (SQLException ignored) {}
        }));
    }

    public static synchronized Connection getConnection() throws SQLException {
        if (realConnection == null || realConnection.isClosed()) {
            realConnection = DriverManager.getConnection(URL);
            try (Statement stmt = realConnection.createStatement()) {
                stmt.execute("PRAGMA foreign_keys = ON");
                stmt.execute("PRAGMA journal_mode = WAL");
            } catch (SQLException e) {
                realConnection.close();
                realConnection = null;
                throw e;
            }
        }
        // Return a proxy that makes close() a no-op so callers can still use try-with-resources
        return (Connection) Proxy.newProxyInstance(
                Connection.class.getClassLoader(),
                new Class<?>[]{ Connection.class },
                (proxy, method, args) -> {
                    if ("close".equals(method.getName())) return null;
                    return method.invoke(realConnection, args);
                });
    }

    public static void setupDatabase() {
        String playersSql = "CREATE TABLE IF NOT EXISTS player_characters ("
                + "id    INTEGER PRIMARY KEY,"
                + "name  TEXT    NOT NULL,"
                + "level INTEGER NOT NULL DEFAULT 1"
                + ")";

        String creaturesSql = "CREATE TABLE IF NOT EXISTS creatures ("
                + "id                     INTEGER PRIMARY KEY,"
                + "name                   TEXT    NOT NULL,"
                + "size                   TEXT,"
                + "creature_type          TEXT,"
                + "subtype                TEXT,"
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
                + "biomes                 TEXT DEFAULT '',"
                + "legendary_action_count INTEGER DEFAULT 0"
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

            stmt.execute(playersSql);
            stmt.execute(creaturesSql);
            stmt.execute(actionsSql);
            stmt.execute(itemsSql);
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
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creatures_name_lower ON creatures(LOWER(name))");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_biomes_biome ON creature_biomes(biome)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_subtypes_subtype ON creature_subtypes(subtype)");

            // Migrate existing comma-delimited data into junction tables
            migrateBiomes(conn);
            migrateSubtypes(conn);

        } catch (SQLException e) {
            System.err.println("Fehler beim Datenbank-Setup: " + e.getMessage());
        }
    }

    private static void migrateSubtypes(Connection conn) {
        migrateDelimitedColumn(conn, "subtype", "creature_subtypes", "subtype", "Subtype-Migration");
    }

    private static void migrateBiomes(Connection conn) {
        migrateDelimitedColumn(conn, "biomes", "creature_biomes", "biome", "Biome-Migration");
    }

    private static void migrateDelimitedColumn(Connection conn, String sourceColumn,
                                               String targetTable, String targetColumn, String label) {
        try (Statement stmt = conn.createStatement()) {
            boolean junctionEmpty;
            try (var rs = stmt.executeQuery("SELECT COUNT(*) FROM " + targetTable)) {
                junctionEmpty = rs.next() && rs.getInt(1) == 0;
            }
            if (!junctionEmpty) return;

            boolean hasData;
            try (var rs = stmt.executeQuery(
                    "SELECT COUNT(*) FROM creatures WHERE " + sourceColumn + " IS NOT NULL AND " + sourceColumn + " != ''")) {
                hasData = rs.next() && rs.getInt(1) > 0;
            }
            if (!hasData) return;

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
        } catch (SQLException e) {
            System.err.println(label + ": " + e.getMessage());
        }
    }
}
