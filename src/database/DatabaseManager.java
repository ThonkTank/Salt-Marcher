package database;

import features.campaignstate.repository.CampaignStateSchemaSupport;
import features.partyanalysis.model.AnalysisModelVersion;
import features.world.dungeonmap.repository.DungeonSchemaSupport;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class DatabaseManager {

    private static final String URL = "jdbc:sqlite:game.db";
    private static final Pattern HIT_DICE_PATTERN =
            Pattern.compile("^\\s*(\\d+)\\s*[dD]\\s*(\\d+)\\s*(([+-])\\s*(\\d+))?\\s*$");

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

            stmt.execute("CREATE TABLE IF NOT EXISTS spells ("
                    + "id                        INTEGER PRIMARY KEY,"
                    + "name                      TEXT    NOT NULL,"
                    + "slug                      TEXT,"
                    + "source                    TEXT,"
                    + "level                     INTEGER NOT NULL DEFAULT 0,"
                    + "school                    TEXT,"
                    + "casting_time              TEXT,"
                    + "range_text                TEXT,"
                    + "duration_text             TEXT,"
                    + "ritual                    INTEGER NOT NULL DEFAULT 0,"
                    + "concentration             INTEGER NOT NULL DEFAULT 0,"
                    + "components_text           TEXT,"
                    + "material_component_text   TEXT,"
                    + "classes_text              TEXT,"
                    + "attack_or_save_text       TEXT,"
                    + "damage_effect_text        TEXT,"
                    + "description               TEXT,"
                    + "higher_levels_text        TEXT,"
                    + "casting_channel           TEXT,"
                    + "target_profile            TEXT,"
                    + "delivery_type             TEXT,"
                    + "is_offensive              INTEGER NOT NULL DEFAULT 0,"
                    + "expected_damage_single    REAL NOT NULL DEFAULT 0.0,"
                    + "expected_damage_small_aoe REAL NOT NULL DEFAULT 0.0,"
                    + "expected_damage_large_aoe REAL NOT NULL DEFAULT 0.0"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS spell_classes ("
                    + "spell_id    INTEGER NOT NULL REFERENCES spells(id) ON DELETE CASCADE,"
                    + "class_name  TEXT    NOT NULL,"
                    + "PRIMARY KEY (spell_id, class_name)"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS spell_damage_types ("
                    + "spell_id    INTEGER NOT NULL REFERENCES spells(id) ON DELETE CASCADE,"
                    + "damage_type TEXT    NOT NULL,"
                    + "PRIMARY KEY (spell_id, damage_type)"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS spell_tags ("
                    + "spell_id INTEGER NOT NULL REFERENCES spells(id) ON DELETE CASCADE,"
                    + "tag      TEXT    NOT NULL,"
                    + "PRIMARY KEY (spell_id, tag)"
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

            DungeonSchemaSupport.createSchema(stmt);

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

            CampaignStateSchemaSupport.createSchema(stmt);

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

            createLootTableSchema(stmt);

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_action_analysis ("
                    + "action_id             INTEGER PRIMARY KEY REFERENCES creature_actions(id) ON DELETE CASCADE,"
                    + "analysis_version      INTEGER NOT NULL DEFAULT 1,"
                    + "is_melee              INTEGER NOT NULL DEFAULT 0,"
                    + "is_ranged             INTEGER NOT NULL DEFAULT 0,"
                    + "is_mixed_melee_ranged INTEGER NOT NULL DEFAULT 0,"
                    + "is_aoe                INTEGER NOT NULL DEFAULT 0,"
                    + "is_buff               INTEGER NOT NULL DEFAULT 0,"
                    + "is_heal               INTEGER NOT NULL DEFAULT 0,"
                    + "is_control            INTEGER NOT NULL DEFAULT 0,"
                    + "has_mobility          INTEGER NOT NULL DEFAULT 0,"
                    + "has_summon            INTEGER NOT NULL DEFAULT 0,"
                    + "is_spellcasting       INTEGER NOT NULL DEFAULT 0,"
                    + "is_offensive_combat_option INTEGER NOT NULL DEFAULT 0,"
                    + "is_support_combat_option   INTEGER NOT NULL DEFAULT 0,"
                    + "is_passive_defense    INTEGER NOT NULL DEFAULT 0,"
                    + "is_pure_utility       INTEGER NOT NULL DEFAULT 0,"
                    + "requires_recharge     INTEGER NOT NULL DEFAULT 0,"
                    + "estimated_rule_lines  INTEGER NOT NULL DEFAULT 1,"
                    + "complexity_points     INTEGER NOT NULL DEFAULT 1,"
                    + "expected_uses_per_round REAL NOT NULL DEFAULT 1.0,"
                    + "action_channel        TEXT,"
                    + "save_dc               INTEGER,"
                    + "save_ability          TEXT,"
                    + "half_damage_on_save   INTEGER NOT NULL DEFAULT 0,"
                    + "targeting_hint        TEXT,"
                    + "base_damage           REAL NOT NULL DEFAULT 0.0,"
                    + "conditional_damage_factor REAL NOT NULL DEFAULT 1.0,"
                    + "legendary_action_cost INTEGER NOT NULL DEFAULT 1,"
                    + "limited_uses          INTEGER,"
                    + "recharge_min          INTEGER,"
                    + "recharge_max          INTEGER,"
                    + "recurring_damage_trait INTEGER NOT NULL DEFAULT 0,"
                    + "spell_level_cap       INTEGER,"
                    + "multiattack_profile   TEXT,"
                    + "spell_options_profile TEXT,"
                    + "parsed_at             TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_static_analysis ("
                    + "creature_id                INTEGER PRIMARY KEY REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "analysis_version           INTEGER NOT NULL DEFAULT 1,"
                    + "primary_function_role      TEXT,"
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
                    + "ranged_identity_score      REAL NOT NULL DEFAULT 0.0,"
                    + "melee_signal_score         REAL NOT NULL DEFAULT 0.0,"
                    + "spellcasting_signal_score  REAL NOT NULL DEFAULT 0.0,"
                    + "aoe_signal_score           REAL NOT NULL DEFAULT 0.0,"
                    + "healing_signal_score       REAL NOT NULL DEFAULT 0.0,"
                    + "summon_signal_score        REAL NOT NULL DEFAULT 0.0,"
                    + "reaction_signal_score      REAL NOT NULL DEFAULT 0.0,"
                    + "stealth_signal_score       REAL NOT NULL DEFAULT 0.0,"
                    + "hide_signal_score          REAL NOT NULL DEFAULT 0.0,"
                    + "invisibility_signal_score  REAL NOT NULL DEFAULT 0.0,"
                    + "obscurement_signal_score   REAL NOT NULL DEFAULT 0.0,"
                    + "forced_movement_signal_score REAL NOT NULL DEFAULT 0.0,"
                    + "ally_enable_signal_score   REAL NOT NULL DEFAULT 0.0,"
                    + "ally_command_signal_score  REAL NOT NULL DEFAULT 0.0,"
                    + "defense_signal_score       REAL NOT NULL DEFAULT 0.0,"
                    + "tank_signal_score          REAL NOT NULL DEFAULT 0.0,"
                    + "ambusher_role_score        REAL NOT NULL DEFAULT 0.0,"
                    + "artillery_role_score       REAL NOT NULL DEFAULT 0.0,"
                    + "brute_role_score           REAL NOT NULL DEFAULT 0.0,"
                    + "soldier_role_score         REAL NOT NULL DEFAULT 0.0,"
                    + "controller_role_score      REAL NOT NULL DEFAULT 0.0,"
                    + "leader_role_score          REAL NOT NULL DEFAULT 0.0,"
                    + "skirmisher_role_score      REAL NOT NULL DEFAULT 0.0,"
                    + "support_role_score         REAL NOT NULL DEFAULT 0.0,"
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
                    + "analysis_model_version INTEGER NOT NULL DEFAULT 1,"
                    + "active_run_id      INTEGER REFERENCES encounter_party_cache_runs(run_id),"
                    + "cache_status       TEXT NOT NULL DEFAULT 'INVALID',"
                    + "last_error         TEXT,"
                    + "updated_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")");

            stmt.execute("CREATE TABLE IF NOT EXISTS creature_party_analysis ("
                    + "run_id                INTEGER NOT NULL REFERENCES encounter_party_cache_runs(run_id) ON DELETE CASCADE,"
                    + "creature_id           INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,"
                    + "weight_class          TEXT,"
                    + "survivability_actions REAL NOT NULL DEFAULT 0.0,"
                    + "action_units_per_round REAL NOT NULL DEFAULT 1.0,"
                    + "offense_pressure      REAL NOT NULL DEFAULT 0.0,"
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
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spells_level ON spells(level)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spells_school ON spells(school)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spells_slug ON spells(slug)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spells_is_offensive ON spells(is_offensive)");
            stmt.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_spells_name_norm_unique "
                    + "ON spells(lower(trim(name)))");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spell_classes_class_name ON spell_classes(class_name)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spell_damage_types_damage_type ON spell_damage_types(damage_type)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spell_tags_tag ON spell_tags(tag)");
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
            DungeonSchemaSupport.createIndexes(stmt);
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_world_locations_tile ON world_locations(tile_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_tile_influence_faction ON tile_faction_influence(faction_id)");
            stmt.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_tod_phases_order ON time_of_day_phases(display_order)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounter_table_entries_table ON encounter_table_entries(table_id)");
            stmt.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_encounter_tables_name_norm_unique "
                    + "ON encounter_tables(lower(trim(name)))");
            createLootTableIndexes(stmt);
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_party_analysis_run ON creature_party_analysis(run_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_cache_runs_version_status "
                    + "ON encounter_party_cache_runs(party_comp_version, status)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_cache_runs_hash ON encounter_party_cache_runs(party_comp_hash)");

            ensureCreatureImportColumns(conn);
            ensureCreatureActionColumns(conn);
            ensureItemTagCompatibility(conn);
            ensureSpellCompatibility(conn);
            ensureEncounterAnalysisColumns(conn);
            ensureLootTableCompatibility(conn);
            DungeonSchemaSupport.ensureCompatibility(conn);
            CampaignStateSchemaSupport.ensureCompatibility(conn);
            dropLegacyRoleColumns(conn);

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
                            + "(id, party_comp_hash, party_comp_version, analysis_model_version, active_run_id, cache_status, updated_at)"
                            + " VALUES(1, '', 0, ?, NULL, 'INVALID', CURRENT_TIMESTAMP)")) {
                ps.setInt(1, AnalysisModelVersion.current());
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
                ParsedHitDice parsed = parseHitDice(hitDiceText);
                if (parsed.isEmpty()) continue;
                update.setInt(1, parsed.count());
                update.setInt(2, parsed.sides());
                update.setInt(3, parsed.modifier());
                update.setLong(4, creatureId);
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private static ParsedHitDice parseHitDice(String expression) {
        if (expression == null || expression.isBlank()) {
            return ParsedHitDice.EMPTY;
        }
        Matcher matcher = HIT_DICE_PATTERN.matcher(expression);
        if (!matcher.matches()) {
            return ParsedHitDice.EMPTY;
        }
        try {
            int count = Integer.parseInt(matcher.group(1));
            int sides = Integer.parseInt(matcher.group(2));
            int modifier = 0;
            if (matcher.group(3) != null) {
                int amount = Integer.parseInt(matcher.group(5));
                modifier = "-".equals(matcher.group(4)) ? -amount : amount;
            }
            if (count <= 0 || sides <= 0) {
                return ParsedHitDice.EMPTY;
            }
            return new ParsedHitDice(count, sides, modifier, false);
        } catch (NumberFormatException ex) {
            return ParsedHitDice.EMPTY;
        }
    }

    private record ParsedHitDice(int count, int sides, int modifier, boolean empty) {
        private static final ParsedHitDice EMPTY = new ParsedHitDice(0, 0, 0, true);

        boolean isEmpty() {
            return empty;
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
        ensureColumn(conn, "creature_action_analysis", "analysis_version", "INTEGER NOT NULL DEFAULT 1");
        ensureColumn(conn, "creature_action_analysis", "is_mixed_melee_ranged", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "creature_action_analysis", "is_spellcasting", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "creature_action_analysis", "is_offensive_combat_option", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "creature_action_analysis", "is_support_combat_option", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "creature_action_analysis", "is_passive_defense", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "creature_action_analysis", "is_pure_utility", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "creature_action_analysis", "action_channel", "TEXT");
        ensureColumn(conn, "creature_action_analysis", "save_dc", "INTEGER");
        ensureColumn(conn, "creature_action_analysis", "save_ability", "TEXT");
        ensureColumn(conn, "creature_action_analysis", "half_damage_on_save", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "creature_action_analysis", "targeting_hint", "TEXT");
        ensureColumn(conn, "creature_action_analysis", "base_damage", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_action_analysis", "conditional_damage_factor", "REAL NOT NULL DEFAULT 1.0");
        ensureColumn(conn, "creature_action_analysis", "legendary_action_cost", "INTEGER NOT NULL DEFAULT 1");
        ensureColumn(conn, "creature_action_analysis", "limited_uses", "INTEGER");
        ensureColumn(conn, "creature_action_analysis", "recharge_min", "INTEGER");
        ensureColumn(conn, "creature_action_analysis", "recharge_max", "INTEGER");
        ensureColumn(conn, "creature_action_analysis", "recurring_damage_trait", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "creature_action_analysis", "spell_level_cap", "INTEGER");
        ensureColumn(conn, "creature_action_analysis", "multiattack_profile", "TEXT");
        ensureColumn(conn, "creature_action_analysis", "spell_options_profile", "TEXT");
        ensureColumn(conn, "creature_static_analysis", "analysis_version", "INTEGER NOT NULL DEFAULT 1");
        ensureColumn(conn, "creature_static_analysis", "primary_function_role", "TEXT");
        ensureColumn(conn, "creature_static_analysis", "capability_tags", "TEXT");
        ensureColumn(conn, "creature_static_analysis", "ranged_identity_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "spellcasting_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "aoe_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "healing_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "summon_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "reaction_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "stealth_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "hide_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "invisibility_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "obscurement_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "forced_movement_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "ally_enable_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "ally_command_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "defense_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "tank_signal_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "ambusher_role_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "artillery_role_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "brute_role_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "soldier_role_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "controller_role_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "leader_role_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "skirmisher_role_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_static_analysis", "support_role_score", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "creature_party_analysis", "weight_class", "TEXT");
        ensureColumn(conn, "creature_party_analysis", "action_units_per_round", "REAL NOT NULL DEFAULT 1.0");
        ensureColumn(conn, "encounter_party_cache_state", "analysis_model_version", "INTEGER NOT NULL DEFAULT 1");
        dropColumnIfExists(conn, "creature_static_analysis", "secondary_function_role");
    }

    private static void dropLegacyRoleColumns(Connection conn) throws SQLException {
        dropIndexIfExists(conn, "idx_party_analysis_run_role");
        dropColumnIfExists(conn, "creature_party_analysis", "dynamic_role");
        dropColumnIfExists(conn, "creatures", "role");
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

    private static void ensureSpellCompatibility(Connection conn) throws SQLException {
        ensureColumn(conn, "spells", "slug", "TEXT");
        ensureColumn(conn, "spells", "source", "TEXT");
        ensureColumn(conn, "spells", "level", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "spells", "school", "TEXT");
        ensureColumn(conn, "spells", "casting_time", "TEXT");
        ensureColumn(conn, "spells", "range_text", "TEXT");
        ensureColumn(conn, "spells", "duration_text", "TEXT");
        ensureColumn(conn, "spells", "ritual", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "spells", "concentration", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "spells", "components_text", "TEXT");
        ensureColumn(conn, "spells", "material_component_text", "TEXT");
        ensureColumn(conn, "spells", "classes_text", "TEXT");
        ensureColumn(conn, "spells", "attack_or_save_text", "TEXT");
        ensureColumn(conn, "spells", "damage_effect_text", "TEXT");
        ensureColumn(conn, "spells", "description", "TEXT");
        ensureColumn(conn, "spells", "higher_levels_text", "TEXT");
        ensureColumn(conn, "spells", "casting_channel", "TEXT");
        ensureColumn(conn, "spells", "target_profile", "TEXT");
        ensureColumn(conn, "spells", "delivery_type", "TEXT");
        ensureColumn(conn, "spells", "is_offensive", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "spells", "expected_damage_single", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "spells", "expected_damage_small_aoe", "REAL NOT NULL DEFAULT 0.0");
        ensureColumn(conn, "spells", "expected_damage_large_aoe", "REAL NOT NULL DEFAULT 0.0");
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spells_level ON spells(level)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spells_school ON spells(school)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spells_slug ON spells(slug)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spells_is_offensive ON spells(is_offensive)");
            stmt.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_spells_name_norm_unique "
                    + "ON spells(lower(trim(name)))");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spell_classes_class_name ON spell_classes(class_name)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spell_damage_types_damage_type ON spell_damage_types(damage_type)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_spell_tags_tag ON spell_tags(tag)");
        }
    }

    private static void ensureLootTableCompatibility(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            createLootTableSchema(stmt);
            createLootTableIndexes(stmt);
        }
    }

    private static void createLootTableSchema(Statement stmt) throws SQLException {
        stmt.execute("CREATE TABLE IF NOT EXISTS loot_tables ("
                + "loot_table_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "name          TEXT NOT NULL,"
                + "description   TEXT"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS loot_table_entries ("
                + "loot_table_id INTEGER NOT NULL REFERENCES loot_tables(loot_table_id) ON DELETE CASCADE,"
                + "item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,"
                + "weight        INTEGER NOT NULL DEFAULT 1,"
                + "PRIMARY KEY (loot_table_id, item_id),"
                + "CHECK (weight BETWEEN 1 AND 10)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS encounter_table_loot_links ("
                + "table_id      INTEGER PRIMARY KEY REFERENCES encounter_tables(table_id) ON DELETE CASCADE,"
                + "loot_table_id INTEGER NOT NULL REFERENCES loot_tables(loot_table_id) ON DELETE CASCADE"
                + ")");
    }

    private static void createLootTableIndexes(Statement stmt) throws SQLException {
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_loot_table_entries_table ON loot_table_entries(loot_table_id)");
        stmt.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_loot_tables_name_norm_unique "
                + "ON loot_tables(lower(trim(name)))");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounter_table_loot_links_loot ON encounter_table_loot_links(loot_table_id)");
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

    private static void dropColumnIfExists(Connection conn, String table, String column) throws SQLException {
        if (!columnExists(conn, table, column)) return;
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE " + table + " DROP COLUMN " + column);
        }
    }

    private static void dropIndexIfExists(Connection conn, String index) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("DROP INDEX IF EXISTS " + index);
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
