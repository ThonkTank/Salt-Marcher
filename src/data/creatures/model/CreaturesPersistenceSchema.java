package src.data.creatures.model;

import java.util.List;

import src.data.persistencecore.model.SqliteTableSpec;

import static src.data.persistencecore.model.SqliteTableSpec.column;
import static src.data.persistencecore.model.SqliteTableSpec.table;

/**
 * Canonical persistence schema for the creatures feature.
 */
public final class CreaturesPersistenceSchema {

    public static final String DATABASE_FILE_NAME = "game.db";

    public static final SqliteTableSpec CREATURES = table(
            "creatures",
            column("id", "INTEGER PRIMARY KEY"),
            column("name", "TEXT NOT NULL"),
            column("size", "TEXT"),
            column("creature_type", "TEXT"),
            column("alignment", "TEXT"),
            column("cr", "TEXT"),
            column("xp", "INTEGER NOT NULL DEFAULT 0"),
            column("hp", "INTEGER NOT NULL DEFAULT 0"),
            column("hit_dice", "TEXT"),
            column("hit_dice_count", "INTEGER"),
            column("hit_dice_sides", "INTEGER"),
            column("hit_dice_modifier", "INTEGER"),
            column("ac", "INTEGER NOT NULL DEFAULT 0"),
            column("ac_notes", "TEXT"),
            column("speed", "INTEGER NOT NULL DEFAULT 0"),
            column("fly_speed", "INTEGER NOT NULL DEFAULT 0"),
            column("swim_speed", "INTEGER NOT NULL DEFAULT 0"),
            column("climb_speed", "INTEGER NOT NULL DEFAULT 0"),
            column("burrow_speed", "INTEGER NOT NULL DEFAULT 0"),
            column("str", "INTEGER NOT NULL DEFAULT 10"),
            column("dex", "INTEGER NOT NULL DEFAULT 10"),
            column("con", "INTEGER NOT NULL DEFAULT 10"),
            column("intel", "INTEGER NOT NULL DEFAULT 10"),
            column("wis", "INTEGER NOT NULL DEFAULT 10"),
            column("cha", "INTEGER NOT NULL DEFAULT 10"),
            column("initiative_bonus", "INTEGER NOT NULL DEFAULT 0"),
            column("proficiency_bonus", "INTEGER NOT NULL DEFAULT 0"),
            column("saving_throws", "TEXT"),
            column("skills", "TEXT"),
            column("damage_vulnerabilities", "TEXT"),
            column("damage_resistances", "TEXT"),
            column("damage_immunities", "TEXT"),
            column("condition_immunities", "TEXT"),
            column("senses", "TEXT"),
            column("passive_perception", "INTEGER NOT NULL DEFAULT 0"),
            column("languages", "TEXT"),
            column("legendary_action_count", "INTEGER NOT NULL DEFAULT 0"),
            column("source_slug", "TEXT"),
            column("slug_key", "TEXT"));

    public static final SqliteTableSpec CREATURE_BIOMES = table(
            "creature_biomes",
            column("creature_id", "INTEGER NOT NULL"),
            column("biome", "TEXT NOT NULL"));

    public static final SqliteTableSpec CREATURE_SUBTYPES = table(
            "creature_subtypes",
            column("creature_id", "INTEGER NOT NULL"),
            column("subtype", "TEXT NOT NULL"));

    public static final SqliteTableSpec CREATURE_ACTIONS = table(
            "creature_actions",
            column("creature_id", "INTEGER NOT NULL"),
            column("action_type", "TEXT NOT NULL"),
            column("name", "TEXT NOT NULL"),
            column("description", "TEXT"),
            column("to_hit_bonus", "INTEGER"));

    public static final List<String> INDEX_SQL = List.of(
            "CREATE INDEX IF NOT EXISTS idx_creatures_type ON creatures(creature_type)",
            "CREATE INDEX IF NOT EXISTS idx_creatures_alignment ON creatures(alignment)",
            "CREATE INDEX IF NOT EXISTS idx_creatures_xp ON creatures(xp)",
            "CREATE INDEX IF NOT EXISTS idx_creatures_name ON creatures(name)",
            "CREATE INDEX IF NOT EXISTS idx_creature_biomes_biome ON creature_biomes(biome)",
            "CREATE INDEX IF NOT EXISTS idx_creature_biomes_creature ON creature_biomes(creature_id)",
            "CREATE INDEX IF NOT EXISTS idx_creature_subtypes_subtype ON creature_subtypes(subtype)",
            "CREATE INDEX IF NOT EXISTS idx_creature_subtypes_creature ON creature_subtypes(creature_id)",
            "CREATE INDEX IF NOT EXISTS idx_creature_actions_creature ON creature_actions(creature_id)"
    );

    private CreaturesPersistenceSchema() {
    }
}
