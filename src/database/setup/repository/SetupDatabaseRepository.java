package database.setup.repository;

import database.DatabaseManager;
import database.setup.state.SetupDatabaseState;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared startup database preparation repository.
 */
@SuppressWarnings("unused")
public final class SetupDatabaseRepository {

    private SetupDatabaseRepository() {
    }

    public static SetupDatabaseState setupDatabase(SetupDatabaseState state) {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        try (Connection conn = DatabaseManager.getConnection();
             Statement stmt = conn.createStatement()) {
            createSchema(stmt);
            seedReferenceData(conn, state);
            applyStartupCompatibility(conn, state);
            return state;
        } catch (SQLException e) {
            throw new RuntimeException("Datenbankschema konnte nicht erstellt werden", e);
        }
    }

    private static void createSchema(Statement stmt) throws SQLException {
        stmt.execute("CREATE TABLE IF NOT EXISTS player_characters ("
                + "id                 INTEGER PRIMARY KEY,"
                + "name               TEXT    NOT NULL,"
                + "player_name        TEXT,"
                + "level              INTEGER NOT NULL DEFAULT 1,"
                + "current_xp         INTEGER NOT NULL DEFAULT 0,"
                + "xp_since_long_rest INTEGER NOT NULL DEFAULT 0,"
                + "xp_since_short_rest INTEGER NOT NULL DEFAULT 0,"
                + "passive_perception INTEGER NOT NULL DEFAULT 10,"
                + "ac                 INTEGER NOT NULL DEFAULT 10,"
                + "in_party           INTEGER NOT NULL DEFAULT 1"
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

        stmt.execute("CREATE TABLE IF NOT EXISTS encounters ("
                + "encounter_id   INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "name           TEXT NOT NULL,"
                + "difficulty     TEXT,"
                + "average_level  INTEGER NOT NULL DEFAULT 1,"
                + "party_size     INTEGER NOT NULL DEFAULT 1,"
                + "xp_budget      INTEGER NOT NULL DEFAULT 0,"
                + "shape_label    TEXT,"
                + "created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                + ")");

        stmt.execute("CREATE TABLE IF NOT EXISTS encounter_slots ("
                + "encounter_slot_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "encounter_id            INTEGER NOT NULL REFERENCES encounters(encounter_id) ON DELETE CASCADE,"
                + "display_order           INTEGER NOT NULL,"
                + "creature_id             INTEGER NOT NULL,"
                + "creature_name           TEXT NOT NULL,"
                + "creature_xp             INTEGER NOT NULL DEFAULT 0,"
                + "creature_hp             INTEGER NOT NULL DEFAULT 0,"
                + "hit_dice_count          INTEGER,"
                + "hit_dice_sides          INTEGER,"
                + "hit_dice_modifier       INTEGER,"
                + "creature_ac             INTEGER NOT NULL DEFAULT 0,"
                + "initiative_bonus        INTEGER NOT NULL DEFAULT 0,"
                + "cr_display              TEXT,"
                + "creature_type           TEXT,"
                + "count                   INTEGER NOT NULL DEFAULT 1,"
                + "weight_class            TEXT,"
                + "primary_function_role   TEXT"
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
                + "campaign_id         INTEGER PRIMARY KEY DEFAULT 1,"
                + "map_id              INTEGER REFERENCES hex_maps(map_id),"
                + "party_tile_id       INTEGER REFERENCES hex_tiles(tile_id),"
                + "calendar_id         INTEGER REFERENCES calendar_config(calendar_id),"
                + "current_epoch_day   INTEGER NOT NULL DEFAULT 0,"
                + "current_phase_id    INTEGER REFERENCES time_of_day_phases(phase_id),"
                + "current_weather     TEXT,"
                + "notes               TEXT,"
                + "dungeon_map_id      INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL,"
                + "dungeon_level_z     INTEGER,"
                + "dungeon_cell_x      INTEGER,"
                + "dungeon_cell_y      INTEGER,"
                + "dungeon_heading     TEXT"
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
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_biomes_biome ON creature_biomes(biome)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_subtypes_subtype ON creature_subtypes(subtype)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_aliases_local_id ON creature_import_aliases(local_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_creature_aliases_slug_key ON creature_import_aliases(slug_key)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_hex_tiles_map ON hex_tiles(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_hex_tiles_faction ON hex_tiles(dominant_faction_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounter_slots_encounter ON encounter_slots(encounter_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounter_slots_order ON encounter_slots(encounter_id, display_order)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounters_created_at ON encounters(created_at)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_encounters_name ON encounters(name)");
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

        // Dungeon startup creates only the current schema. Older dungeon storage shapes are unsupported and must
        // be reset explicitly instead of being upgraded in-place at runtime.
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_maps ("
                + "dungeon_map_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "name           TEXT NOT NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_structure_objects ("
                + "structure_object_id INTEGER PRIMARY KEY AUTOINCREMENT"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_clusters ("
                + "cluster_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "structure_object_id INTEGER NOT NULL UNIQUE REFERENCES dungeon_structure_objects(structure_object_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_rooms ("
                + "room_id         INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id  INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "cluster_id      INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                + "name            TEXT NOT NULL,"
                + "visual_description TEXT,"
                + "component_x     INTEGER NOT NULL,"
                + "component_y     INTEGER NOT NULL,"
                + "level_z         INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridors ("
                + "corridor_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "structure_object_id INTEGER NOT NULL UNIQUE REFERENCES dungeon_structure_objects(structure_object_id),"
                + "level_z          INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_structure_levels ("
                + "structure_object_id INTEGER NOT NULL REFERENCES dungeon_structure_objects(structure_object_id) ON DELETE CASCADE,"
                + "level_z            INTEGER NOT NULL,"
                + "anchor_x2          INTEGER NOT NULL,"
                + "anchor_y2          INTEGER NOT NULL,"
                + "PRIMARY KEY (structure_object_id, level_z)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_structure_surface_cells ("
                + "structure_object_id INTEGER NOT NULL,"
                + "level_z            INTEGER NOT NULL,"
                + "cell_x2            INTEGER NOT NULL,"
                + "cell_y2            INTEGER NOT NULL,"
                + "PRIMARY KEY (structure_object_id, level_z, cell_x2, cell_y2),"
                + "FOREIGN KEY(structure_object_id, level_z) REFERENCES dungeon_structure_levels(structure_object_id, level_z) ON DELETE CASCADE"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_structure_floor_cells ("
                + "structure_object_id INTEGER NOT NULL,"
                + "level_z            INTEGER NOT NULL,"
                + "cell_x2            INTEGER NOT NULL,"
                + "cell_y2            INTEGER NOT NULL,"
                + "PRIMARY KEY (structure_object_id, level_z, cell_x2, cell_y2),"
                + "FOREIGN KEY(structure_object_id, level_z) REFERENCES dungeon_structure_levels(structure_object_id, level_z) ON DELETE CASCADE"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_wall_kinds ("
                + "wall_kind_id               INTEGER PRIMARY KEY,"
                + "wall_key                   TEXT NOT NULL UNIQUE,"
                + "name                       TEXT NOT NULL,"
                + "blocks_passage             INTEGER NOT NULL DEFAULT 1,"
                + "blocks_sight               INTEGER NOT NULL DEFAULT 1,"
                + "render_style               TEXT NOT NULL,"
                + "supports_door_attachments  INTEGER NOT NULL DEFAULT 1,"
                + "built_in                   INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("INSERT OR IGNORE INTO dungeon_wall_kinds("
                + "wall_kind_id, wall_key, name, blocks_passage, blocks_sight, render_style, supports_door_attachments, built_in"
                + ") VALUES(1, 'solid', 'Massive Wand', 1, 1, 'SOLID', 1, 1)");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_structure_doors ("
                + "door_id             INTEGER PRIMARY KEY,"
                + "structure_object_id INTEGER NOT NULL REFERENCES dungeon_structure_objects(structure_object_id) ON DELETE CASCADE,"
                + "level_z             INTEGER NOT NULL,"
                + "anchor_start_x2     INTEGER NOT NULL,"
                + "anchor_start_y2     INTEGER NOT NULL,"
                + "anchor_end_x2       INTEGER NOT NULL,"
                + "anchor_end_y2       INTEGER NOT NULL,"
                + "door_state          TEXT NOT NULL,"
                + "CHECK(door_state IN ('OPEN','CLOSED'))"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_structure_door_segments ("
                + "door_id          INTEGER NOT NULL REFERENCES dungeon_structure_doors(door_id) ON DELETE CASCADE,"
                + "start_x2         INTEGER NOT NULL,"
                + "start_y2         INTEGER NOT NULL,"
                + "end_x2           INTEGER NOT NULL,"
                + "end_y2           INTEGER NOT NULL,"
                + "PRIMARY KEY (door_id, start_x2, start_y2, end_x2, end_y2)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_input_nodes ("
                + "node_id               INTEGER PRIMARY KEY,"
                + "corridor_id           INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "door_id               INTEGER REFERENCES dungeon_structure_doors(door_id),"
                + "point_x2              INTEGER,"
                + "point_y2              INTEGER,"
                + "CHECK((door_id IS NOT NULL AND point_x2 IS NULL AND point_y2 IS NULL)"
                + " OR (door_id IS NULL AND point_x2 IS NOT NULL AND point_y2 IS NOT NULL)),"
                + "UNIQUE(corridor_id, node_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_input_segments ("
                + "segment_id            INTEGER PRIMARY KEY,"
                + "corridor_id           INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                + "start_node_id         INTEGER NOT NULL,"
                + "end_node_id           INTEGER NOT NULL,"
                + "UNIQUE(corridor_id, segment_id),"
                + "FOREIGN KEY(corridor_id, start_node_id) REFERENCES dungeon_corridor_input_nodes(corridor_id, node_id) ON DELETE CASCADE,"
                + "FOREIGN KEY(corridor_id, end_node_id) REFERENCES dungeon_corridor_input_nodes(corridor_id, node_id) ON DELETE CASCADE"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_levels ("
                + "room_id          INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL,"
                + "anchor_x2        INTEGER NOT NULL,"
                + "anchor_y2        INTEGER NOT NULL,"
                + "PRIMARY KEY (room_id, level_z)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_structure_walls ("
                + "wall_id             INTEGER PRIMARY KEY,"
                + "structure_object_id INTEGER NOT NULL REFERENCES dungeon_structure_objects(structure_object_id) ON DELETE CASCADE,"
                + "level_z             INTEGER NOT NULL,"
                + "wall_kind_id        INTEGER NOT NULL REFERENCES dungeon_wall_kinds(wall_kind_id),"
                + "anchor_start_x2     INTEGER NOT NULL,"
                + "anchor_start_y2     INTEGER NOT NULL,"
                + "anchor_end_x2       INTEGER NOT NULL,"
                + "anchor_end_y2       INTEGER NOT NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_structure_wall_segments ("
                + "wall_id          INTEGER NOT NULL REFERENCES dungeon_structure_walls(wall_id) ON DELETE CASCADE,"
                + "start_x2         INTEGER NOT NULL,"
                + "start_y2         INTEGER NOT NULL,"
                + "end_x2           INTEGER NOT NULL,"
                + "end_y2           INTEGER NOT NULL,"
                + "PRIMARY KEY (wall_id, start_x2, start_y2, end_x2, end_y2)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_exit_descriptions ("
                + "room_id          INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL DEFAULT 0,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "edge_direction   TEXT NOT NULL,"
                + "description      TEXT,"
                + "sort_order       INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (room_id, level_z, cell_x, cell_y, edge_direction)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_stairs ("
                + "stair_id         INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name             TEXT,"
                + "anchor_cell_x    INTEGER NOT NULL,"
                + "anchor_cell_y    INTEGER NOT NULL,"
                + "anchor_level_z   INTEGER NOT NULL,"
                + "shape_kind       TEXT NOT NULL,"
                + "shape_direction_code INTEGER NOT NULL DEFAULT 0,"
                + "shape_param1     INTEGER NOT NULL DEFAULT 0,"
                + "shape_param2     INTEGER NOT NULL DEFAULT 0,"
                + "min_level_z      INTEGER NOT NULL,"
                + "max_level_z      INTEGER NOT NULL,"
                + "CHECK(shape_kind IN ('STACK','LINE','SQUARE','RECTANGLE','CIRCLE'))"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_stair_path_nodes ("
                + "stair_id         INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                + "sort_order       INTEGER NOT NULL,"
                + "cell_x           INTEGER NOT NULL,"
                + "cell_y           INTEGER NOT NULL,"
                + "cell_z           INTEGER NOT NULL,"
                + "PRIMARY KEY (stair_id, sort_order)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_stair_stop_levels ("
                + "stair_id         INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                + "level_z          INTEGER NOT NULL,"
                + "PRIMARY KEY (stair_id, level_z)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_transition_stair_path_nodes ("
                + "transition_id     INTEGER NOT NULL REFERENCES dungeon_transitions(transition_id) ON DELETE CASCADE,"
                + "sort_order        INTEGER NOT NULL,"
                + "cell_x            INTEGER NOT NULL,"
                + "cell_y            INTEGER NOT NULL,"
                + "cell_z            INTEGER NOT NULL,"
                + "PRIMARY KEY (transition_id, sort_order)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_transition_stair_stop_levels ("
                + "transition_id     INTEGER NOT NULL REFERENCES dungeon_transitions(transition_id) ON DELETE CASCADE,"
                + "level_z           INTEGER NOT NULL,"
                + "PRIMARY KEY (transition_id, level_z)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_transitions ("
                + "transition_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id           INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "description              TEXT,"
                + "placement_type           TEXT,"
                + "door_id                  INTEGER REFERENCES dungeon_structure_doors(door_id),"
                + "stair_anchor_cell_x      INTEGER,"
                + "stair_anchor_cell_y      INTEGER,"
                + "stair_anchor_level_z     INTEGER,"
                + "stair_shape_kind         TEXT,"
                + "stair_shape_direction_code INTEGER,"
                + "stair_shape_param1       INTEGER,"
                + "stair_shape_param2       INTEGER,"
                + "stair_min_level_z        INTEGER,"
                + "stair_max_level_z        INTEGER,"
                + "destination_type         TEXT NOT NULL,"
                + "target_overworld_map_id  INTEGER REFERENCES hex_maps(map_id) ON DELETE SET NULL,"
                + "target_overworld_tile_id INTEGER REFERENCES hex_tiles(tile_id) ON DELETE SET NULL,"
                + "target_dungeon_map_id    INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL,"
                + "target_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL,"
                + "linked_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL"
                + ")");
    }

    private static void seedReferenceData(Connection conn, SetupDatabaseState state) throws SQLException {
        try (PreparedStatement phaseSeed = conn.prepareStatement(
                "INSERT OR IGNORE INTO time_of_day_phases(phase_name, display_order, is_dark) VALUES(?,?,?)")) {
            String[] names = {"Morgendämmerung", "Morgen", "Mittag", "Abend", "Nacht"};
            int[] orders = {1, 2, 3, 4, 5};
            int[] darkFlags = {0, 0, 0, 0, 1};
            for (int index = 0; index < names.length; index++) {
                phaseSeed.setString(1, names[index]);
                phaseSeed.setInt(2, orders[index]);
                phaseSeed.setInt(3, darkFlags[index]);
                phaseSeed.addBatch();
            }
            phaseSeed.executeBatch();
        }

        try (PreparedStatement calendarSeed = conn.prepareStatement(
                "INSERT OR IGNORE INTO calendar_config(name, days_per_month, month_names, special_days, year_base) VALUES(?,?,?,?,?)")) {
            calendarSeed.setString(1, "Forgotten Realms");
            calendarSeed.setString(2, "30,30,30,30,30,30,30,30,30,30,30,30");
            calendarSeed.setString(3, "Hammer,Alturiak,Ches,Tarsakh,Mirtul,Kythorn,Flamerule,Eleasias,Eleint,Marpenoth,Uktar,Nightal");
            calendarSeed.setString(4, "31=Midwinter,92=Greengrass,183=Midsummer,274=Highharvestide,335=Feast of the Moon");
            calendarSeed.setInt(5, 1);
            calendarSeed.executeUpdate();
        }

        long calendarId = loadRequiredLong(
                conn,
                "SELECT calendar_id FROM calendar_config WHERE name='Forgotten Realms'",
                "calendar_config seed did not produce a 'Forgotten Realms' row");
        long morgenPhaseId = loadRequiredLong(
                conn,
                "SELECT phase_id FROM time_of_day_phases WHERE phase_name='Morgen'",
                "time_of_day_phases seed did not produce a 'Morgen' row");

        try (PreparedStatement campaignStateSeed = conn.prepareStatement(
                "INSERT OR IGNORE INTO campaign_state(campaign_id, calendar_id, current_epoch_day, current_phase_id) VALUES(1,?,0,?)")) {
            campaignStateSeed.setLong(1, calendarId);
            campaignStateSeed.setLong(2, morgenPhaseId);
            campaignStateSeed.executeUpdate();
        }

        try (PreparedStatement cacheStateSeed = conn.prepareStatement(
                "INSERT OR IGNORE INTO encounter_party_cache_state"
                        + "(id, party_comp_hash, party_comp_version, analysis_model_version, active_run_id, cache_status, updated_at)"
                        + " VALUES(1, '', 0, ?, NULL, 'INVALID', CURRENT_TIMESTAMP)")) {
            cacheStateSeed.setInt(1, state.analysisModelVersion());
            cacheStateSeed.executeUpdate();
        }
    }

    private static void applyStartupCompatibility(Connection conn, SetupDatabaseState state) throws SQLException {
        ensureCreatureImportColumns(conn);
        ensureCreatureActionColumns(conn);
        ensurePartyCharacterCompatibility(conn, state);
        ensureItemTagCompatibility(conn);
        ensureSpellCompatibility(conn);
        ensureEncounterAnalysisColumns(conn);
        ensureLootTableCompatibility(conn);
        dropLegacyRoleColumns(conn);
    }

    private static long loadRequiredLong(Connection conn, String sql, String failureMessage) throws SQLException {
        try (PreparedStatement select = conn.prepareStatement(sql);
             ResultSet rs = select.executeQuery()) {
            if (!rs.next()) {
                throw new SQLException(failureMessage);
            }
            return rs.getLong(1);
        }
    }

    private static void ensureCreatureImportColumns(Connection conn) throws SQLException {
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
                int[] parsedHitDice = parseHitDice(rs.getString("hit_dice"));
                if (parsedHitDice == null) {
                    continue;
                }
                update.setInt(1, parsedHitDice[0]);
                update.setInt(2, parsedHitDice[1]);
                update.setInt(3, parsedHitDice[2]);
                update.setLong(4, rs.getLong("id"));
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private static int[] parseHitDice(String expression) {
        if (expression == null || expression.isBlank()) {
            return null;
        }
        Matcher matcher = Pattern.compile("^\\s*(\\d+)\\s*[dD]\\s*(\\d+)\\s*(([+-])\\s*(\\d+))?\\s*$")
                .matcher(expression);
        if (!matcher.matches()) {
            return null;
        }
        try {
            int count = Integer.parseInt(matcher.group(1));
            int sides = Integer.parseInt(matcher.group(2));
            int modifier = matcher.group(3) == null
                    ? 0
                    : ("-".equals(matcher.group(4))
                    ? -Integer.parseInt(matcher.group(5))
                    : Integer.parseInt(matcher.group(5)));
            if (count <= 0 || sides <= 0) {
                return null;
            }
            return new int[]{count, sides, modifier};
        } catch (NumberFormatException ex) {
            return null;
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

    private static void ensurePartyCharacterCompatibility(Connection conn, SetupDatabaseState state) throws SQLException {
        ensureColumn(conn, "player_characters", "player_name", "TEXT");
        ensureColumn(conn, "player_characters", "passive_perception", "INTEGER NOT NULL DEFAULT 10");
        ensureColumn(conn, "player_characters", "ac", "INTEGER NOT NULL DEFAULT 10");
        ensureColumn(conn, "player_characters", "current_xp", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "player_characters", "xp_since_long_rest", "INTEGER NOT NULL DEFAULT 0");
        ensureColumn(conn, "player_characters", "xp_since_short_rest", "INTEGER NOT NULL DEFAULT 0");
        dropColumnIfExists(conn, "player_characters", "short_rests_taken");
        backfillCharacterXpFloors(conn, state);
    }

    private static void backfillCharacterXpFloors(Connection conn, SetupDatabaseState state) throws SQLException {
        String selectSql = "SELECT id, level, current_xp FROM player_characters";
        String updateSql = "UPDATE player_characters SET current_xp = ? WHERE id = ?";
        try (PreparedStatement select = conn.prepareStatement(selectSql);
             ResultSet rs = select.executeQuery();
             PreparedStatement update = conn.prepareStatement(updateSql)) {
            while (rs.next()) {
                long id = rs.getLong("id");
                int level = rs.getInt("level");
                int currentXp = rs.getInt("current_xp");
                int normalizedXp = Math.max(currentXp, minimumXpForLevel(state, level));
                if (normalizedXp == currentXp) {
                    continue;
                }
                update.setInt(1, normalizedXp);
                update.setLong(2, id);
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private static int minimumXpForLevel(SetupDatabaseState state, int level) {
        for (SetupDatabaseState.LevelXpFloorState floor : state.levelXpFloors()) {
            if (floor.level() == level) {
                return floor.minimumXp();
            }
        }
        return 0;
    }

    private static void ensureItemTagCompatibility(Connection conn) throws SQLException {
        if (!columnExists(conn, "items", "tags")) {
            return;
        }
        String selectLegacy = "SELECT id, tags FROM items WHERE tags IS NOT NULL AND TRIM(tags) <> ''";
        try (PreparedStatement select = conn.prepareStatement(selectLegacy);
             ResultSet rs = select.executeQuery();
             PreparedStatement hasTags = conn.prepareStatement(
                     "SELECT 1 FROM item_tags WHERE item_id = ? LIMIT 1");
             PreparedStatement insertTag = conn.prepareStatement(
                     "INSERT OR IGNORE INTO item_tags(item_id, tag) VALUES(?, ?)")) {
            while (rs.next()) {
                long itemId = rs.getLong("id");
                if (itemHasCanonicalTags(hasTags, itemId)) {
                    continue;
                }
                String tagsCsv = rs.getString("tags");
                if (tagsCsv == null || tagsCsv.isBlank()) {
                    continue;
                }
                for (String raw : tagsCsv.split(",")) {
                    String tag = raw.trim();
                    if (tag.isEmpty()) {
                        continue;
                    }
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
        if (columnExists(conn, table, column)) {
            return;
        }
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
        }
    }

    private static void dropColumnIfExists(Connection conn, String table, String column) throws SQLException {
        if (!columnExists(conn, table, column)) {
            return;
        }
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
                if (column.equalsIgnoreCase(rs.getString("name"))) {
                    return true;
                }
            }
            return false;
        }
    }
}
