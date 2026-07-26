package features.creatures.adapter.sqlite.model;

import java.util.List;
import platform.persistence.SqliteTableSpec;

import static platform.persistence.SqliteTableSpec.column;
import static platform.persistence.SqliteTableSpec.table;

/**
 * Canonical persistence schema for the creatures feature.
 */
public final class CreaturesPersistenceSchema {

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

    public static final String TEMP_FILTER_SIZES_TABLE = "sm_temp_filter_sizes";
    public static final String TEMP_FILTER_TYPES_TABLE = "sm_temp_filter_types";
    public static final String TEMP_FILTER_ALIGNMENTS_TABLE = "sm_temp_filter_alignments";
    public static final String TEMP_FILTER_SUBTYPES_TABLE = "sm_temp_filter_subtypes";
    public static final String TEMP_FILTER_BIOMES_TABLE = "sm_temp_filter_biomes";

    public static final String CREATE_CREATURES_TABLE_SQL =
            "CREATE TABLE creatures ("
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
            "CREATE TABLE creature_biomes ("
                    + "creature_id INTEGER NOT NULL, "
                    + "biome TEXT NOT NULL"
                    + ")";

    public static final String CREATE_CREATURE_SUBTYPES_TABLE_SQL =
            "CREATE TABLE creature_subtypes ("
                    + "creature_id INTEGER NOT NULL, "
                    + "subtype TEXT NOT NULL"
                    + ")";

    public static final String CREATE_CREATURE_ACTIONS_TABLE_SQL =
            "CREATE TABLE creature_actions ("
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
            "CREATE INDEX idx_creatures_type ON creatures(creature_type)";

    public static final String CREATE_CREATURES_ALIGNMENT_INDEX_SQL =
            "CREATE INDEX idx_creatures_alignment ON creatures(alignment)";

    public static final String CREATE_CREATURES_XP_INDEX_SQL =
            "CREATE INDEX idx_creatures_xp ON creatures(xp)";

    public static final String CREATE_CREATURES_NAME_INDEX_SQL =
            "CREATE INDEX idx_creatures_name ON creatures(name)";

    public static final String CREATE_CREATURE_BIOMES_BIOME_INDEX_SQL =
            "CREATE INDEX idx_creature_biomes_biome ON creature_biomes(biome)";

    public static final String CREATE_CREATURE_BIOMES_CREATURE_INDEX_SQL =
            "CREATE INDEX idx_creature_biomes_creature ON creature_biomes(creature_id)";

    public static final String CREATE_CREATURE_SUBTYPES_SUBTYPE_INDEX_SQL =
            "CREATE INDEX idx_creature_subtypes_subtype ON creature_subtypes(subtype)";

    public static final String CREATE_CREATURE_SUBTYPES_CREATURE_INDEX_SQL =
            "CREATE INDEX idx_creature_subtypes_creature ON creature_subtypes(creature_id)";

    public static final String CREATE_CREATURE_ACTIONS_CREATURE_INDEX_SQL =
            "CREATE INDEX idx_creature_actions_creature ON creature_actions(creature_id)";

    public static final List<String> CREATE_TABLE_SQL = List.of(
            CREATE_CREATURES_TABLE_SQL,
            CREATE_CREATURE_BIOMES_TABLE_SQL,
            CREATE_CREATURE_SUBTYPES_TABLE_SQL,
            CREATE_CREATURE_ACTIONS_TABLE_SQL);

    public static final List<String> CREATE_INDEX_SQL = List.of(
            CREATE_CREATURES_TYPE_INDEX_SQL,
            CREATE_CREATURES_ALIGNMENT_INDEX_SQL,
            CREATE_CREATURES_XP_INDEX_SQL,
            CREATE_CREATURES_NAME_INDEX_SQL,
            CREATE_CREATURE_BIOMES_BIOME_INDEX_SQL,
            CREATE_CREATURE_BIOMES_CREATURE_INDEX_SQL,
            CREATE_CREATURE_SUBTYPES_SUBTYPE_INDEX_SQL,
            CREATE_CREATURE_SUBTYPES_CREATURE_INDEX_SQL,
            CREATE_CREATURE_ACTIONS_CREATURE_INDEX_SQL);

    private CreaturesPersistenceSchema() {
    }
}
