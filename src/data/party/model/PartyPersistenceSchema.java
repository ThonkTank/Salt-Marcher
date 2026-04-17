package src.data.party.model;

import src.data.persistencecore.model.SqliteTableSpec;

import static src.data.persistencecore.model.SqliteTableSpec.column;
import static src.data.persistencecore.model.SqliteTableSpec.table;

/**
 * Canonical persistence schema for the party feature.
 */
public final class PartyPersistenceSchema {

    public static final String DATABASE_FILE_NAME = "game.db";

    public static final SqliteTableSpec PLAYER_CHARACTERS = table(
            "player_characters",
            column("id", "INTEGER PRIMARY KEY"),
            column("name", "TEXT NOT NULL"),
            column("player_name", "TEXT"),
            column("level", "INTEGER NOT NULL DEFAULT 1"),
            column("current_xp", "INTEGER NOT NULL DEFAULT 0"),
            column("xp_since_long_rest", "INTEGER NOT NULL DEFAULT 0"),
            column("xp_since_short_rest", "INTEGER NOT NULL DEFAULT 0"),
            column("short_rests_taken_since_long_rest", "INTEGER NOT NULL DEFAULT 0"),
            column("passive_perception", "INTEGER NOT NULL DEFAULT 10"),
            column("ac", "INTEGER NOT NULL DEFAULT 10"),
            column("in_party", "INTEGER NOT NULL DEFAULT 1"));

    public static final SqliteTableSpec PARTY_ROSTER_METADATA = table(
            "party_roster_metadata",
            column("singleton_id", "INTEGER PRIMARY KEY CHECK (singleton_id = 1)"),
            column("next_character_id", "INTEGER NOT NULL"));

    public static final String INITIALIZE_METADATA_SQL =
            "INSERT OR IGNORE INTO party_roster_metadata(singleton_id, next_character_id) VALUES (1, 1)";

    private PartyPersistenceSchema() {
    }
}
