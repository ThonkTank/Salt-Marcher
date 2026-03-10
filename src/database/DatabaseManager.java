package database;

import features.creaturecatalog.model.HitDice;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

public final class DatabaseManager {

    private static final String URL = "jdbc:sqlite:game.db";

    private DatabaseManager() {
        throw new AssertionError("No instances");
    }

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
     * Schema policy:
     * - Imported source data (monsters/items/equipment/spells) is disposable and
     *   can be rebuilt by re-crawling.
     * - User-created campaign data (e.g. encounter tables) must be preserved.
     *
     * Therefore this method allows lightweight, additive, idempotent compatibility
     * migrations where needed to keep existing user databases usable
     * (see ensureCreatureImportColumns). We intentionally avoid destructive or
     * multi-step migration ladders here.
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
                    + "hit_dice_count         INTEGER,"
                    + "hit_dice_sides         INTEGER,"
                    + "hit_dice_modifier      INTEGER,"
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
                    + "role                   TEXT,"
                    + "source_slug            TEXT,"
                    + "slug_key               TEXT"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_actions ("
                    + "id          INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "action_type TEXT    NOT NULL DEFAULT 'action',"
                    + "name        TEXT,"
                    + "description TEXT,"
                    + "to_hit_bonus INTEGER"
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
                    + "source               TEXT"
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

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_import_aliases ("
                    + "source_slug TEXT PRIMARY KEY,"
                    + "slug_key    TEXT,"
                    + "external_id INTEGER,"
                    + "local_id    INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
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

            stmt.execute("CREATE TABLE IF NOT EXISTS encounter_tables ("
                    + "table_id    INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "name        TEXT    NOT NULL,"
                    + "description TEXT"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS encounter_table_entries ("
                    + "table_id    INTEGER NOT NULL REFERENCES encounter_tables(table_id) ON DELETE CASCADE,"
                    + "creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "weight      INTEGER NOT NULL DEFAULT 1,"
                    + "PRIMARY KEY (table_id, creature_id),"
                    + "CHECK (weight BETWEEN 1 AND 10)"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_action_analysis ("
                    + "action_id             INTEGER PRIMARY KEY REFERENCES creature_actions(id) ON DELETE CASCADE,"
                    + "analysis_version      INTEGER NOT NULL DEFAULT 1,"
                    + "is_melee              INTEGER NOT NULL DEFAULT 0,"
                    + "is_ranged             INTEGER NOT NULL DEFAULT 0,"
                    + "is_aoe                INTEGER NOT NULL DEFAULT 0,"
                    + "is_buff               INTEGER NOT NULL DEFAULT 0,"
                    + "is_heal               INTEGER NOT NULL DEFAULT 0,"
                    + "is_control            INTEGER NOT NULL DEFAULT 0,"
                    + "has_mobility          INTEGER NOT NULL DEFAULT 0,"
                    + "has_summon            INTEGER NOT NULL DEFAULT 0,"
                    + "requires_recharge     INTEGER NOT NULL DEFAULT 0,"
                    + "estimated_rule_lines  INTEGER NOT NULL DEFAULT 1,"
                    + "complexity_points     INTEGER NOT NULL DEFAULT 1,"
                    + "expected_uses_per_round REAL NOT NULL DEFAULT 1.0,"
                    + "parsed_at             TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_static_analysis ("
                    + "creature_id                INTEGER PRIMARY KEY REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "analysis_version           INTEGER NOT NULL DEFAULT 1,"
                    + "primary_function_role      TEXT,"
                    + "secondary_function_role    TEXT,"
                    + "capability_tags            TEXT,"
                    + "base_action_units_per_round REAL NOT NULL DEFAULT 1.0,"
                    + "legendary_action_units     REAL NOT NULL DEFAULT 0.0,"
                    + "has_reaction               INTEGER NOT NULL DEFAULT 0,"
                    + "total_complexity_points    INTEGER NOT NULL DEFAULT 0,"
                    + "complex_feature_count      INTEGER NOT NULL DEFAULT 0,"
                    + "support_signal_score       REAL NOT NULL DEFAULT 0.0,"
                    + "control_signal_score       REAL NOT NULL DEFAULT 0.0,"
                    + "mobility_signal_score      REAL NOT NULL DEFAULT 0.0,"
                    + "ranged_signal_score        REAL NOT NULL DEFAULT 0.0,"
                    + "melee_signal_score         REAL NOT NULL DEFAULT 0.0,"
                    + "spellcasting_signal_score  REAL NOT NULL DEFAULT 0.0,"
                    + "aoe_signal_score           REAL NOT NULL DEFAULT 0.0,"
                    + "healing_signal_score       REAL NOT NULL DEFAULT 0.0,"
                    + "summon_signal_score        REAL NOT NULL DEFAULT 0.0,"
                    + "reaction_signal_score      REAL NOT NULL DEFAULT 0.0,"
                    + "updated_at                 TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS encounter_party_cache_runs ("
                    + "run_id             INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "party_comp_version INTEGER NOT NULL,"
                    + "party_comp_hash    TEXT NOT NULL,"
                    + "status             TEXT NOT NULL,"
                    + "started_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,"
                    + "finished_at        TEXT,"
                    + "error_message      TEXT"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS encounter_party_cache_state ("
                    + "id                 INTEGER PRIMARY KEY CHECK (id = 1),"
                    + "party_comp_hash    TEXT NOT NULL,"
                    + "party_comp_version INTEGER NOT NULL DEFAULT 0,"
                    + "active_run_id      INTEGER REFERENCES encounter_party_cache_runs(run_id),"
                    + "cache_status       TEXT NOT NULL DEFAULT 'INVALID',"
                    + "last_error         TEXT,"
                    + "updated_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_party_analysis ("
                    + "run_id                INTEGER NOT NULL REFERENCES encounter_party_cache_runs(run_id) ON DELETE CASCADE,"
                    + "creature_id           INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "dynamic_role          TEXT NOT NULL,"
                    + "weight_class          TEXT,"
                    + "survivability_actions REAL NOT NULL DEFAULT 0.0,"
                    + "offense_pressure      REAL NOT NULL DEFAULT 0.0,"
                    + "expected_turn_share   REAL NOT NULL DEFAULT 0.0,"
                    + "minionness_score      REAL NOT NULL DEFAULT 0.0,"
                    + "gm_complexity_load    REAL NOT NULL DEFAULT 0.0,"
                    + "fit_flags             TEXT,"
                    + "computed_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,"
                    + "PRIMARY KEY (run_id, creature_id)"
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
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_aliases_local_id ON creature_import_aliases(local_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_aliases_slug_key ON creature_import_aliases(slug_key)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_hex_tiles_map ON hex_tiles(map_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_hex_tiles_faction ON hex_tiles(dominant_faction_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_world_locations_tile ON world_locations(tile_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_tile_influence_faction ON tile_faction_influence(faction_id)");
            stmt.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_tod_phases_order ON time_of_day_phases(display_order)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounter_table_entries_table ON encounter_table_entries(table_id)");
            stmt.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_encounter_tables_name_norm_unique "
                    + "ON encounter_tables(lower(trim(name)))");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_action_analysis_version ON creature_action_analysis(analysis_version)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_static_analysis_version ON creature_static_analysis(analysis_version)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_party_analysis_run ON creature_party_analysis(run_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_party_analysis_run_role ON creature_party_analysis(run_id, dynamic_role)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_cache_runs_version_status "
                    + "ON encounter_party_cache_runs(party_comp_version, status)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_cache_runs_hash ON encounter_party_cache_runs(party_comp_hash)");

            ensureCreatureImportColumns(conn);
            ensureCreatureActionColumns(conn);
            ensureItemTagCompatibility(conn);
            ensureEncounterAnalysisColumns(conn);

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

            // Seed encounter cache singleton state (hash is replaced during first invalidation pass).
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT OR IGNORE INTO encounter_party_cache_state"
                            + "(id, party_comp_hash, party_comp_version, active_run_id, cache_status, updated_at)"
                            + " VALUES(1, '', 0, NULL, 'INVALID', CURRENT_TIMESTAMP)")) {
                ps.executeUpdate();
            }

        } catch (SQLException e) {
            throw new RuntimeException("Datenbankschema konnte nicht erstellt werden", e);
        }
    }

    private static void ensureCreatureImportColumns(Connection conn) throws SQLException {
        // Additive compatibility migration for existing DBs:
        // preserves user-created rows while importer schema evolves.
        if (!columnExists(conn, "creatures", "source_slug")) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE creatures ADD COLUMN source_slug TEXT");
            }
        }
        if (!columnExists(conn, "creatures", "slug_key")) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE creatures ADD COLUMN slug_key TEXT");
            }
        }
        if (!columnExists(conn, "creatures", "hit_dice_count")) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE creatures ADD COLUMN hit_dice_count INTEGER");
            }
        }
        if (!columnExists(conn, "creatures", "hit_dice_sides")) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE creatures ADD COLUMN hit_dice_sides INTEGER");
            }
        }
        if (!columnExists(conn, "creatures", "hit_dice_modifier")) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE creatures ADD COLUMN hit_dice_modifier INTEGER");
            }
        }
        backfillParsedHitDice(conn);
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creatures_source_slug ON creatures(source_slug)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_creatures_slug_key ON creatures(slug_key)");
        }
    }

    private static void backfillParsedHitDice(Connection conn) throws SQLException {
        String selectSql = "SELECT id, hit_dice FROM creatures "
                + "WHERE hit_dice IS NOT NULL AND TRIM(hit_dice) <> '' "
                + "AND (hit_dice_count IS NULL OR hit_dice_sides IS NULL)";
        String updateSql = "UPDATE creatures SET hit_dice_count = ?, hit_dice_sides = ?, hit_dice_modifier = ? "
                + "WHERE id = ?";
        try (PreparedStatement select = conn.prepareStatement(selectSql);
             ResultSet rs = select.executeQuery();
             PreparedStatement update = conn.prepareStatement(updateSql)) {
            while (rs.next()) {
                long creatureId = rs.getLong("id");
                String hitDiceText = rs.getString("hit_dice");
                var parsed = HitDice.tryParse(hitDiceText);
                if (parsed.isEmpty()) continue;
                HitDice hitDice = parsed.get();
                update.setInt(1, hitDice.count());
                update.setInt(2, hitDice.sides());
                update.setInt(3, hitDice.modifier());
                update.setLong(4, creatureId);
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private static void ensureCreatureActionColumns(Connection conn) throws SQLException {
        if (!columnExists(conn, "creature_actions", "to_hit_bonus")) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE creature_actions ADD COLUMN to_hit_bonus INTEGER");
            }
        }
    }

    private static void ensureEncounterAnalysisColumns(Connection conn) throws SQLException {
        ensureColumn(conn, "creature_static_analysis", "primary_function_role", "TEXT");
        ensureColumn(conn, "creature_static_analysis", "secondary_function_role", "TEXT");
        ensureColumn(conn, "creature_static_analysis", "capability_tags", "TEXT");
        ensureColumn(conn, "creature_static_analysis", "spellcasting_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "aoe_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "healing_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "summon_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "reaction_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_party_analysis", "weight_class", "TEXT");
    }

    private static void ensureItemTagCompatibility(Connection conn) throws SQLException {
        // One-way compatibility migration:
        // backfill canonical item_tags from legacy items.tags if that old column exists.
        if (!columnExists(conn, "items", "tags")) return;

        String selectLegacy = "SELECT id, tags FROM items WHERE tags IS NOT NULL AND TRIM(tags) <> ''";
        try (PreparedStatement select = conn.prepareStatement(selectLegacy);
             ResultSet rs = select.executeQuery();
             PreparedStatement hasTags = conn.prepareStatement(
                     "SELECT 1 FROM item_tags WHERE item_id = ? LIMIT 1");
             PreparedStatement insertTag = conn.prepareStatement(
                     "INSERT OR IGNORE INTO item_tags(item_id, tag) VALUES(?, ?)")) {
            while (rs.next()) {
                long itemId = rs.getLong("id");
                if (itemHasCanonicalTags(hasTags, itemId)) continue;
                String tagsCsv = rs.getString("tags");
                if (tagsCsv == null || tagsCsv.isBlank()) continue;

                for (String raw : tagsCsv.split(",")) {
                    String tag = raw.trim();
                    if (tag.isEmpty()) continue;
                    insertTag.setLong(1, itemId);
                    insertTag.setString(2, tag);
                    insertTag.addBatch();
                }
            }
            insertTag.executeBatch();
        }
    }

    private static boolean itemHasCanonicalTags(PreparedStatement hasTags, long itemId) throws SQLException {
        hasTags.clearParameters();
        hasTags.setLong(1, itemId);
        try (ResultSet rs = hasTags.executeQuery()) {
            return rs.next();
        }
    }

    private static void ensureColumn(Connection conn, String table, String column, String definition) throws SQLException {
        if (columnExists(conn, table, column)) return;
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
        }
    }

    private static boolean columnExists(Connection conn, String table, String column) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("PRAGMA table_info(" + table + ")");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                if (column.equalsIgnoreCase(rs.getString("name"))) return true;
            }
            return false;
        }
    }
}
