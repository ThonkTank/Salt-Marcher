package database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

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

    /**
     * Creates all tables and seeds required reference data.
     * Safe to call on every startup: all DDL uses CREATE TABLE IF NOT EXISTS,
     * all seed inserts use INSERT OR IGNORE.
     *
     * NOTE: This method performs NO migrations on existing databases.
     * The legacy schema migration ladder (versions 1–6, meta table) was
     * removed when the codebase moved to a fresh-install model.
     * If you are working with a game.db from before this change, delete it
     * and re-crawl (./crawl.sh). For future schema changes that require
     * ALTER TABLE, re-introduce a meta-based version table at that point.
     */
    public static void setupDatabase() {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {

            // Tables created unconditionally (CREATE TABLE IF NOT EXISTS).
            // Seed data uses INSERT OR IGNORE — re-runs are safe.
            // Table creation order respects FK constraints: parent tables precede child tables.

            stmt.execute("CREATE TABLE IF NOT EXISTS player_characters ("
                    + "id       INTEGER PRIMARY KEY,"
                    + "name     TEXT    NOT NULL,"
                    + "level    INTEGER NOT NULL DEFAULT 1,"
                    + "in_party INTEGER NOT NULL DEFAULT 1"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creatures ("
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
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_actions ("
                    + "id          INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "action_type TEXT    NOT NULL DEFAULT 'action',"
                    + "name        TEXT,"
                    + "description TEXT"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS items ("
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
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS item_tags ("
                    + "item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,"
                    + "tag     TEXT    NOT NULL,"
                    + "PRIMARY KEY (item_id, tag)"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_biomes ("
                    + "creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "biome       TEXT    NOT NULL,"
                    + "PRIMARY KEY (creature_id, biome)"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_subtypes ("
                    + "creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "subtype     TEXT    NOT NULL,"
                    + "PRIMARY KEY (creature_id, subtype)"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS hex_maps ("
                    + "map_id     INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "name       TEXT    NOT NULL,"
                    + "is_bounded INTEGER NOT NULL DEFAULT 0,"
                    + "radius     INTEGER"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS factions ("
                    + "faction_id  INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "name        TEXT    NOT NULL UNIQUE,"
                    + "color_hex   TEXT,"
                    + "description TEXT"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS hex_tiles ("
                    + "tile_id             INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "map_id              INTEGER NOT NULL REFERENCES hex_maps(map_id) ON DELETE CASCADE,"
                    + "q                   INTEGER NOT NULL,"
                    + "r                   INTEGER NOT NULL,"
                    + "terrain_type        TEXT    NOT NULL DEFAULT 'grassland',"
                    + "elevation           INTEGER NOT NULL DEFAULT 0,"
                    + "biome               TEXT,"
                    + "is_explored         INTEGER NOT NULL DEFAULT 0,"
                    + "dominant_faction_id INTEGER,"
                    + "notes               TEXT,"
                    + "UNIQUE (map_id, q, r)"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS world_locations ("
                    + "location_id   INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "tile_id       INTEGER NOT NULL REFERENCES hex_tiles(tile_id) ON DELETE CASCADE,"
                    + "name          TEXT    NOT NULL,"
                    + "location_type TEXT    NOT NULL,"
                    + "description   TEXT,"
                    + "is_discovered INTEGER NOT NULL DEFAULT 0"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS calendar_config ("
                    + "calendar_id    INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "name           TEXT    NOT NULL,"
                    + "days_per_month TEXT    NOT NULL,"
                    + "month_names    TEXT    NOT NULL,"
                    + "special_days   TEXT,"
                    + "year_base      INTEGER NOT NULL DEFAULT 1"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS time_of_day_phases ("
                    + "phase_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "phase_name    TEXT    NOT NULL UNIQUE,"
                    + "display_order INTEGER NOT NULL,"
                    + "is_dark       INTEGER NOT NULL DEFAULT 0"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS campaign_state ("
                    + "campaign_id       INTEGER PRIMARY KEY DEFAULT 1,"
                    + "map_id            INTEGER REFERENCES hex_maps(map_id),"
                    + "party_tile_id     INTEGER REFERENCES hex_tiles(tile_id),"
                    + "calendar_id       INTEGER REFERENCES calendar_config(calendar_id),"
                    + "current_epoch_day INTEGER NOT NULL DEFAULT 0,"
                    + "current_phase_id  INTEGER REFERENCES time_of_day_phases(phase_id),"
                    + "current_weather   TEXT,"
                    + "notes             TEXT"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS tile_faction_influence ("
                    + "tile_id      INTEGER NOT NULL REFERENCES hex_tiles(tile_id) ON DELETE CASCADE,"
                    + "faction_id   INTEGER NOT NULL REFERENCES factions(faction_id) ON DELETE CASCADE,"
                    + "influence    INTEGER NOT NULL DEFAULT 0,"
                    + "control_type TEXT    NOT NULL DEFAULT 'presence',"
                    + "PRIMARY KEY (tile_id, faction_id),"
                    + "CHECK (influence BETWEEN 0 AND 100)"
                    + ")");

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
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_hex_tiles_map ON hex_tiles(map_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_hex_tiles_faction ON hex_tiles(dominant_faction_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_world_locations_tile ON world_locations(tile_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_tile_influence_faction ON tile_faction_influence(faction_id)");
            stmt.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_tod_phases_order ON time_of_day_phases(display_order)");

            // Seed default time-of-day phases (German UI strings)
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT OR IGNORE INTO time_of_day_phases(phase_name, display_order, is_dark) VALUES(?,?,?)")) {
                record Phase(String name, int order, int isDark) {}
                var phases = List.of(
                    new Phase("Morgendämmerung", 1, 0),
                    new Phase("Morgen",          2, 0),
                    new Phase("Mittag",          3, 0),
                    new Phase("Abend",           4, 0),
                    new Phase("Nacht",           5, 1));
                for (Phase p : phases) {
                    ps.setString(1, p.name());
                    ps.setInt(2, p.order());
                    ps.setInt(3, p.isDark());
                    ps.addBatch();
                }
                ps.executeBatch();
            }

            // Seed Forgotten Realms calendar
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT OR IGNORE INTO calendar_config(name, days_per_month, month_names, special_days, year_base) VALUES(?,?,?,?,?)")) {
                ps.setString(1, "Forgotten Realms");
                ps.setString(2, "30,30,30,30,30,30,30,30,30,30,30,30");
                ps.setString(3, "Hammer,Alturiak,Ches,Tarsakh,Mirtul,Kythorn,Flamerule,Eleasias,Eleint,Marpenoth,Uktar,Nightal");
                ps.setString(4, "31=Midwinter,92=Greengrass,183=Midsummer,274=Highharvestide,335=Feast of the Moon");
                ps.setInt(5, 1);
                ps.executeUpdate();
            }

            // Always query the actual ID — INSERT OR IGNORE does not return generated keys on a no-op
            long calendarId;
            try (PreparedStatement sel = conn.prepareStatement(
                    "SELECT calendar_id FROM calendar_config WHERE name='Forgotten Realms'");
                 ResultSet idRs = sel.executeQuery()) {
                if (!idRs.next()) throw new SQLException(
                    "calendar_config seed did not produce a 'Forgotten Realms' row");
                calendarId = idRs.getLong(1);
            }

            // Always query the actual ID — INSERT OR IGNORE does not return generated keys on a no-op
            long morgenPhaseId;
            try (PreparedStatement selPhase = conn.prepareStatement(
                    "SELECT phase_id FROM time_of_day_phases WHERE phase_name='Morgen'");
                 ResultSet phaseRs = selPhase.executeQuery()) {
                if (!phaseRs.next()) throw new SQLException(
                    "time_of_day_phases seed did not produce a 'Morgen' row");
                morgenPhaseId = phaseRs.getLong(1);
            }

            // Seed campaign_state singleton (id=1) with default calendar + phase
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT OR IGNORE INTO campaign_state(campaign_id, calendar_id, current_epoch_day, current_phase_id) VALUES(1,?,0,?)")) {
                ps.setLong(1, calendarId);
                ps.setLong(2, morgenPhaseId);
                ps.executeUpdate();
            }

        } catch (SQLException e) {
            throw new RuntimeException("Datenbankschema konnte nicht erstellt werden", e);
        }
    }
}
