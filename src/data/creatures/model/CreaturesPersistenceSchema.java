package src.data.creatures.model;

import src.data.persistencecore.model.SqliteTableSpec;

import static src.data.persistencecore.model.SqliteTableSpec.column;
import static src.data.persistencecore.model.SqliteTableSpec.table;

/**
 * Canonical persistence schema for the creatures feature.
 */
public final class CreaturesPersistenceSchema {

    public static final String DATABASE_FILE_NAME = "game.db";

    private static final String INTEGER_TYPE = "INTEGER";
    private static final String INTEGER_ZERO_DEFAULT = "INTEGER NOT NULL DEFAULT 0";
    private static final String INTEGER_TEN_DEFAULT = "INTEGER NOT NULL DEFAULT 10";
    private static final String TEXT_TYPE = "TEXT";
    private static final String TEXT_REQUIRED = "TEXT NOT NULL";

    public static final SqliteTableSpec CREATURES = table(
            "creatures",
            column("id", "INTEGER PRIMARY KEY"),
            column("name", TEXT_REQUIRED),
            column("size", TEXT_TYPE),
            column("creature_type", TEXT_TYPE),
            column("alignment", TEXT_TYPE),
            column("cr", TEXT_TYPE),
            column("xp", INTEGER_ZERO_DEFAULT),
            column("hp", INTEGER_ZERO_DEFAULT),
            column("hit_dice", TEXT_TYPE),
            column("hit_dice_count", INTEGER_TYPE),
            column("hit_dice_sides", INTEGER_TYPE),
            column("hit_dice_modifier", INTEGER_TYPE),
            column("ac", INTEGER_ZERO_DEFAULT),
            column("ac_notes", TEXT_TYPE),
            column("speed", INTEGER_ZERO_DEFAULT),
            column("fly_speed", INTEGER_ZERO_DEFAULT),
            column("swim_speed", INTEGER_ZERO_DEFAULT),
            column("climb_speed", INTEGER_ZERO_DEFAULT),
            column("burrow_speed", INTEGER_ZERO_DEFAULT),
            column("str", INTEGER_TEN_DEFAULT),
            column("dex", INTEGER_TEN_DEFAULT),
            column("con", INTEGER_TEN_DEFAULT),
            column("intel", INTEGER_TEN_DEFAULT),
            column("wis", INTEGER_TEN_DEFAULT),
            column("cha", INTEGER_TEN_DEFAULT),
            column("initiative_bonus", INTEGER_ZERO_DEFAULT),
            column("proficiency_bonus", INTEGER_ZERO_DEFAULT),
            column("saving_throws", TEXT_TYPE),
            column("skills", TEXT_TYPE),
            column("damage_vulnerabilities", TEXT_TYPE),
            column("damage_resistances", TEXT_TYPE),
            column("damage_immunities", TEXT_TYPE),
            column("condition_immunities", TEXT_TYPE),
            column("senses", TEXT_TYPE),
            column("passive_perception", INTEGER_ZERO_DEFAULT),
            column("languages", TEXT_TYPE),
            column("legendary_action_count", INTEGER_ZERO_DEFAULT),
            column("source_slug", TEXT_TYPE),
            column("slug_key", TEXT_TYPE));

    public static final SqliteTableSpec CREATURE_BIOMES = table(
            "creature_biomes",
            column("creature_id", "INTEGER NOT NULL"),
            column("biome", TEXT_REQUIRED));

    public static final SqliteTableSpec CREATURE_SUBTYPES = table(
            "creature_subtypes",
            column("creature_id", "INTEGER NOT NULL"),
            column("subtype", TEXT_REQUIRED));

    public static final SqliteTableSpec CREATURE_ACTIONS = table(
            "creature_actions",
            column("creature_id", "INTEGER NOT NULL"),
            column("action_type", TEXT_REQUIRED),
            column("name", TEXT_REQUIRED),
            column("description", TEXT_TYPE),
            column("to_hit_bonus", INTEGER_TYPE));

    public static final String CREATE_CREATURES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS creatures ("
                    + "id INTEGER PRIMARY KEY, "
                    + "name TEXT NOT NULL, "
                    + "size TEXT, "
                    + "creature_type TEXT, "
                    + "alignment TEXT, "
                    + "cr TEXT, "
                    + "xp INTEGER NOT NULL DEFAULT 0, "
                    + "hp INTEGER NOT NULL DEFAULT 0, "
                    + "hit_dice TEXT, "
                    + "hit_dice_count INTEGER, "
                    + "hit_dice_sides INTEGER, "
                    + "hit_dice_modifier INTEGER, "
                    + "ac INTEGER NOT NULL DEFAULT 0, "
                    + "ac_notes TEXT, "
                    + "speed INTEGER NOT NULL DEFAULT 0, "
                    + "fly_speed INTEGER NOT NULL DEFAULT 0, "
                    + "swim_speed INTEGER NOT NULL DEFAULT 0, "
                    + "climb_speed INTEGER NOT NULL DEFAULT 0, "
                    + "burrow_speed INTEGER NOT NULL DEFAULT 0, "
                    + "str INTEGER NOT NULL DEFAULT 10, "
                    + "dex INTEGER NOT NULL DEFAULT 10, "
                    + "con INTEGER NOT NULL DEFAULT 10, "
                    + "intel INTEGER NOT NULL DEFAULT 10, "
                    + "wis INTEGER NOT NULL DEFAULT 10, "
                    + "cha INTEGER NOT NULL DEFAULT 10, "
                    + "initiative_bonus INTEGER NOT NULL DEFAULT 0, "
                    + "proficiency_bonus INTEGER NOT NULL DEFAULT 0, "
                    + "saving_throws TEXT, "
                    + "skills TEXT, "
                    + "damage_vulnerabilities TEXT, "
                    + "damage_resistances TEXT, "
                    + "damage_immunities TEXT, "
                    + "condition_immunities TEXT, "
                    + "senses TEXT, "
                    + "passive_perception INTEGER NOT NULL DEFAULT 0, "
                    + "languages TEXT, "
                    + "legendary_action_count INTEGER NOT NULL DEFAULT 0, "
                    + "source_slug TEXT, "
                    + "slug_key TEXT"
                    + ")";

    public static final String CREATE_CREATURE_BIOMES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS creature_biomes ("
                    + "creature_id INTEGER NOT NULL, "
                    + "biome TEXT NOT NULL"
                    + ")";

    public static final String CREATE_CREATURE_SUBTYPES_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS creature_subtypes ("
                    + "creature_id INTEGER NOT NULL, "
                    + "subtype TEXT NOT NULL"
                    + ")";

    public static final String CREATE_CREATURE_ACTIONS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS creature_actions ("
                    + "creature_id INTEGER NOT NULL, "
                    + "action_type TEXT NOT NULL, "
                    + "name TEXT NOT NULL, "
                    + "description TEXT, "
                    + "to_hit_bonus INTEGER"
                    + ")";

    public static final String CREATE_TEMP_FILTER_SIZES_TABLE_SQL =
            "CREATE TEMP TABLE IF NOT EXISTS sm_temp_filter_sizes(value TEXT NOT NULL)";

    public static final String CREATE_TEMP_FILTER_TYPES_TABLE_SQL =
            "CREATE TEMP TABLE IF NOT EXISTS sm_temp_filter_types(value TEXT NOT NULL)";

    public static final String CREATE_TEMP_FILTER_ALIGNMENTS_TABLE_SQL =
            "CREATE TEMP TABLE IF NOT EXISTS sm_temp_filter_alignments(value TEXT NOT NULL)";

    public static final String CREATE_TEMP_FILTER_SUBTYPES_TABLE_SQL =
            "CREATE TEMP TABLE IF NOT EXISTS sm_temp_filter_subtypes(value TEXT NOT NULL)";

    public static final String CREATE_TEMP_FILTER_BIOMES_TABLE_SQL =
            "CREATE TEMP TABLE IF NOT EXISTS sm_temp_filter_biomes(value TEXT NOT NULL)";

    public static final String CREATE_CREATURES_TYPE_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_creatures_type ON creatures(creature_type)";

    public static final String CREATE_CREATURES_ALIGNMENT_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_creatures_alignment ON creatures(alignment)";

    public static final String CREATE_CREATURES_XP_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_creatures_xp ON creatures(xp)";

    public static final String CREATE_CREATURES_NAME_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_creatures_name ON creatures(name)";

    public static final String CREATE_CREATURE_BIOMES_BIOME_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_creature_biomes_biome ON creature_biomes(biome)";

    public static final String CREATE_CREATURE_BIOMES_CREATURE_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_creature_biomes_creature ON creature_biomes(creature_id)";

    public static final String CREATE_CREATURE_SUBTYPES_SUBTYPE_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_creature_subtypes_subtype ON creature_subtypes(subtype)";

    public static final String CREATE_CREATURE_SUBTYPES_CREATURE_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_creature_subtypes_creature ON creature_subtypes(creature_id)";

    public static final String CREATE_CREATURE_ACTIONS_CREATURE_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_creature_actions_creature ON creature_actions(creature_id)";

    public static final String ADD_CREATURE_NAME_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN name TEXT NOT NULL DEFAULT ''";

    public static final String ADD_CREATURE_SIZE_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN size TEXT";

    public static final String ADD_CREATURE_TYPE_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN creature_type TEXT";

    public static final String ADD_CREATURE_ALIGNMENT_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN alignment TEXT";

    public static final String ADD_CREATURE_CR_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN cr TEXT";

    public static final String ADD_CREATURE_XP_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN xp INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_HP_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN hp INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_HIT_DICE_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN hit_dice TEXT";

    public static final String ADD_CREATURE_HIT_DICE_COUNT_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN hit_dice_count INTEGER";

    public static final String ADD_CREATURE_HIT_DICE_SIDES_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN hit_dice_sides INTEGER";

    public static final String ADD_CREATURE_HIT_DICE_MODIFIER_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN hit_dice_modifier INTEGER";

    public static final String ADD_CREATURE_AC_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN ac INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_AC_NOTES_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN ac_notes TEXT";

    public static final String ADD_CREATURE_SPEED_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN speed INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_FLY_SPEED_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN fly_speed INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_SWIM_SPEED_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN swim_speed INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_CLIMB_SPEED_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN climb_speed INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_BURROW_SPEED_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN burrow_speed INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_STR_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN str INTEGER NOT NULL DEFAULT 10";

    public static final String ADD_CREATURE_DEX_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN dex INTEGER NOT NULL DEFAULT 10";

    public static final String ADD_CREATURE_CON_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN con INTEGER NOT NULL DEFAULT 10";

    public static final String ADD_CREATURE_INTEL_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN intel INTEGER NOT NULL DEFAULT 10";

    public static final String ADD_CREATURE_WIS_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN wis INTEGER NOT NULL DEFAULT 10";

    public static final String ADD_CREATURE_CHA_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN cha INTEGER NOT NULL DEFAULT 10";

    public static final String ADD_CREATURE_INITIATIVE_BONUS_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN initiative_bonus INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_PROFICIENCY_BONUS_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN proficiency_bonus INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_SAVING_THROWS_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN saving_throws TEXT";

    public static final String ADD_CREATURE_SKILLS_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN skills TEXT";

    public static final String ADD_CREATURE_DAMAGE_VULNERABILITIES_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN damage_vulnerabilities TEXT";

    public static final String ADD_CREATURE_DAMAGE_RESISTANCES_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN damage_resistances TEXT";

    public static final String ADD_CREATURE_DAMAGE_IMMUNITIES_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN damage_immunities TEXT";

    public static final String ADD_CREATURE_CONDITION_IMMUNITIES_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN condition_immunities TEXT";

    public static final String ADD_CREATURE_SENSES_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN senses TEXT";

    public static final String ADD_CREATURE_PASSIVE_PERCEPTION_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN passive_perception INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_LANGUAGES_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN languages TEXT";

    public static final String ADD_CREATURE_LEGENDARY_ACTION_COUNT_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN legendary_action_count INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_SOURCE_SLUG_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN source_slug TEXT";

    public static final String ADD_CREATURE_SLUG_KEY_COLUMN_SQL =
            "ALTER TABLE creatures ADD COLUMN slug_key TEXT";

    public static final String ADD_CREATURE_BIOME_CREATURE_ID_COLUMN_SQL =
            "ALTER TABLE creature_biomes ADD COLUMN creature_id INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_BIOME_VALUE_COLUMN_SQL =
            "ALTER TABLE creature_biomes ADD COLUMN biome TEXT NOT NULL DEFAULT ''";

    public static final String ADD_CREATURE_SUBTYPE_CREATURE_ID_COLUMN_SQL =
            "ALTER TABLE creature_subtypes ADD COLUMN creature_id INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_SUBTYPE_VALUE_COLUMN_SQL =
            "ALTER TABLE creature_subtypes ADD COLUMN subtype TEXT NOT NULL DEFAULT ''";

    public static final String ADD_CREATURE_ACTION_CREATURE_ID_COLUMN_SQL =
            "ALTER TABLE creature_actions ADD COLUMN creature_id INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_CREATURE_ACTION_TYPE_COLUMN_SQL =
            "ALTER TABLE creature_actions ADD COLUMN action_type TEXT NOT NULL DEFAULT ''";

    public static final String ADD_CREATURE_ACTION_NAME_COLUMN_SQL =
            "ALTER TABLE creature_actions ADD COLUMN name TEXT NOT NULL DEFAULT ''";

    public static final String ADD_CREATURE_ACTION_DESCRIPTION_COLUMN_SQL =
            "ALTER TABLE creature_actions ADD COLUMN description TEXT";

    public static final String ADD_CREATURE_ACTION_TO_HIT_BONUS_COLUMN_SQL =
            "ALTER TABLE creature_actions ADD COLUMN to_hit_bonus INTEGER";

    private CreaturesPersistenceSchema() {
    }
}
