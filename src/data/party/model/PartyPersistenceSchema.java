package src.data.party.model;

import src.data.persistencecore.model.SqliteTableSpec;

import static src.data.persistencecore.model.SqliteTableSpec.column;
import static src.data.persistencecore.model.SqliteTableSpec.table;

/**
 * Canonical persistence schema for the party feature.
 */
public final class PartyPersistenceSchema {

    public static final String DATABASE_FILE_NAME = "game.db";

    private static final String INTEGER_ZERO_DEFAULT = "INTEGER NOT NULL DEFAULT 0";

    public static final SqliteTableSpec PLAYER_CHARACTERS = table(
            "player_characters",
            column("id", "INTEGER PRIMARY KEY"),
            column("name", "TEXT NOT NULL"),
            column("player_name", "TEXT"),
            column("level", "INTEGER NOT NULL DEFAULT 1"),
            column("current_xp", INTEGER_ZERO_DEFAULT),
            column("xp_since_long_rest", INTEGER_ZERO_DEFAULT),
            column("xp_since_short_rest", INTEGER_ZERO_DEFAULT),
            column("short_rests_taken_since_long_rest", INTEGER_ZERO_DEFAULT),
            column("passive_perception", "INTEGER NOT NULL DEFAULT 10"),
            column("ac", "INTEGER NOT NULL DEFAULT 10"),
            column("in_party", "INTEGER NOT NULL DEFAULT 1"));

    public static final SqliteTableSpec PARTY_ROSTER_METADATA = table(
            "party_roster_metadata",
            column("singleton_id", "INTEGER PRIMARY KEY CHECK (singleton_id = 1)"),
            column("next_character_id", "INTEGER NOT NULL"));

    public static final String CREATE_PLAYER_CHARACTERS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS player_characters ("
                    + "id INTEGER PRIMARY KEY, "
                    + "name TEXT NOT NULL, "
                    + "player_name TEXT, "
                    + "level INTEGER NOT NULL DEFAULT 1, "
                    + "current_xp INTEGER NOT NULL DEFAULT 0, "
                    + "xp_since_long_rest INTEGER NOT NULL DEFAULT 0, "
                    + "xp_since_short_rest INTEGER NOT NULL DEFAULT 0, "
                    + "short_rests_taken_since_long_rest INTEGER NOT NULL DEFAULT 0, "
                    + "passive_perception INTEGER NOT NULL DEFAULT 10, "
                    + "ac INTEGER NOT NULL DEFAULT 10, "
                    + "in_party INTEGER NOT NULL DEFAULT 1"
                    + ")";

    public static final String CREATE_PARTY_ROSTER_METADATA_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS party_roster_metadata ("
                    + "singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1), "
                    + "next_character_id INTEGER NOT NULL"
                    + ")";

    public static final String INITIALIZE_METADATA_SQL =
            "INSERT OR IGNORE INTO party_roster_metadata(singleton_id, next_character_id) VALUES (1, 1)";

    public static final String ADD_PLAYER_NAME_COLUMN_SQL =
            "ALTER TABLE player_characters ADD COLUMN player_name TEXT";

    public static final String ADD_PASSIVE_PERCEPTION_COLUMN_SQL =
            "ALTER TABLE player_characters ADD COLUMN passive_perception INTEGER NOT NULL DEFAULT 10";

    public static final String ADD_AC_COLUMN_SQL =
            "ALTER TABLE player_characters ADD COLUMN ac INTEGER NOT NULL DEFAULT 10";

    public static final String ADD_CURRENT_XP_COLUMN_SQL =
            "ALTER TABLE player_characters ADD COLUMN current_xp INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_XP_SINCE_LONG_REST_COLUMN_SQL =
            "ALTER TABLE player_characters ADD COLUMN xp_since_long_rest INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_XP_SINCE_SHORT_REST_COLUMN_SQL =
            "ALTER TABLE player_characters ADD COLUMN xp_since_short_rest INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_SHORT_RESTS_TAKEN_SINCE_LONG_REST_COLUMN_SQL =
            "ALTER TABLE player_characters ADD COLUMN short_rests_taken_since_long_rest INTEGER NOT NULL DEFAULT 0";

    public static final String ADD_IN_PARTY_COLUMN_SQL =
            "ALTER TABLE player_characters ADD COLUMN in_party INTEGER NOT NULL DEFAULT 1";

    private PartyPersistenceSchema() {
    }
}
