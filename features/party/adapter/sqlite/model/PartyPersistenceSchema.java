package features.party.adapter.sqlite.model;

import platform.persistence.SqliteTableSpec;

import java.util.List;

import static platform.persistence.SqliteTableSpec.column;
import static platform.persistence.SqliteTableSpec.table;

/**
 * Canonical persistence schema for the party feature.
 */
public final class PartyPersistenceSchema {

    private static final String TEXT = "TEXT";
    private static final String INTEGER = "INTEGER";
    private static final String INTEGER_ZERO_DEFAULT = "INTEGER NOT NULL DEFAULT 0";

    public static final SqliteTableSpec PLAYER_CHARACTERS = table(
            "player_characters",
            column("id", "INTEGER PRIMARY KEY"),
            column("name", "TEXT NOT NULL"),
            column("player_name", TEXT),
            column("level", INTEGER),
            column("current_xp", INTEGER_ZERO_DEFAULT),
            column("xp_since_long_rest", INTEGER_ZERO_DEFAULT),
            column("xp_since_short_rest", INTEGER_ZERO_DEFAULT),
            column("short_rests_taken_since_long_rest", INTEGER_ZERO_DEFAULT),
            column("passive_perception", INTEGER),
            column("ac", INTEGER),
            column("in_party", "INTEGER NOT NULL DEFAULT 0"),
            column("travel_location_kind", TEXT),
            column("travel_dungeon_map_id", INTEGER),
            column("travel_dungeon_location_kind", TEXT),
            column("travel_dungeon_owner_id", INTEGER),
            column("travel_dungeon_q", INTEGER),
            column("travel_dungeon_r", INTEGER),
            column("travel_dungeon_level", INTEGER),
            column("travel_dungeon_heading", TEXT),
            column("travel_overworld_map_id", INTEGER),
            column("travel_overworld_tile_id", INTEGER),
            column("attached_to_party_token", "INTEGER NOT NULL DEFAULT 0"));

    public static final SqliteTableSpec PARTY_ROSTER_METADATA = table(
            "party_roster_metadata",
            column("singleton_id", "INTEGER PRIMARY KEY CHECK (singleton_id = 1)"),
            column("next_character_id", "INTEGER NOT NULL"));

    public static final String CREATE_PLAYER_CHARACTERS_TABLE_SQL =
            "CREATE TABLE player_characters ("
                    + "id INTEGER PRIMARY KEY, "
                    + "name TEXT NOT NULL, "
                    + "player_name TEXT, "
                    + "level INTEGER, "
                    + "current_xp INTEGER NOT NULL DEFAULT 0, "
                    + "xp_since_long_rest INTEGER NOT NULL DEFAULT 0, "
                    + "xp_since_short_rest INTEGER NOT NULL DEFAULT 0, "
                    + "short_rests_taken_since_long_rest INTEGER NOT NULL DEFAULT 0, "
                    + "passive_perception INTEGER, "
                    + "ac INTEGER, "
                    + "in_party INTEGER NOT NULL DEFAULT 0, "
                    + "travel_location_kind TEXT, "
                    + "travel_dungeon_map_id INTEGER, "
                    + "travel_dungeon_location_kind TEXT, "
                    + "travel_dungeon_owner_id INTEGER, "
                    + "travel_dungeon_q INTEGER, "
                    + "travel_dungeon_r INTEGER, "
                    + "travel_dungeon_level INTEGER, "
                    + "travel_dungeon_heading TEXT, "
                    + "travel_overworld_map_id INTEGER, "
                    + "travel_overworld_tile_id INTEGER, "
                    + "attached_to_party_token INTEGER NOT NULL DEFAULT 0"
                    + ")";

    public static final String CREATE_PARTY_ROSTER_METADATA_TABLE_SQL =
            "CREATE TABLE party_roster_metadata ("
                    + "singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1), "
                    + "next_character_id INTEGER NOT NULL"
                    + ")";

    public static final String INITIALIZE_METADATA_SQL =
            "INSERT OR IGNORE INTO party_roster_metadata(singleton_id, next_character_id) VALUES (1, 1)";

    public static final List<String> CREATE_TABLE_SQL = List.of(
            CREATE_PLAYER_CHARACTERS_TABLE_SQL,
            CREATE_PARTY_ROSTER_METADATA_TABLE_SQL);

    public static final List<String> CREATE_INDEX_SQL = List.of();

    private PartyPersistenceSchema() {
    }
}
