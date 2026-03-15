package features.world.dungeonmap.repository.schema;

import database.SchemaCompatibility;

import java.sql.SQLException;
import java.sql.Statement;

/**
 * Encapsulates dungeon-specific schema creation so bootstrap does not own the SQL details.
 */
public final class DungeonSchemaSupport {

    private DungeonSchemaSupport() {
        throw new AssertionError("No instances");
    }

    public static void createSchema(Statement stmt) throws SQLException {
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_maps ("
                + "dungeon_map_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "name           TEXT NOT NULL,"
                + "width          INTEGER NOT NULL,"
                + "height         INTEGER NOT NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_areas ("
                + "area_id             INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id              INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name                TEXT NOT NULL,"
                + "description         TEXT,"
                + "encounter_every_hours INTEGER NOT NULL DEFAULT 6"
                + ")");
        ensureColumn(stmt, "dungeon_areas", "encounter_every_hours", "INTEGER NOT NULL DEFAULT 6");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_area_encounter_tables ("
                + "area_id      INTEGER NOT NULL REFERENCES dungeon_areas(area_id) ON DELETE CASCADE,"
                + "table_id     INTEGER NOT NULL REFERENCES encounter_tables(table_id) ON DELETE CASCADE,"
                + "weight       INTEGER NOT NULL DEFAULT 1,"
                + "sort_order   INTEGER NOT NULL DEFAULT 0,"
                + "PRIMARY KEY (area_id, table_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_rooms ("
                + "room_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id        INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name          TEXT NOT NULL,"
                + "light_level   TEXT,"
                + "visual_description TEXT,"
                + "sounds_description TEXT,"
                + "smells_description TEXT,"
                + "other_description TEXT,"
                + "glance_description TEXT,"
                + "detail_description TEXT,"
                + "reactive_checks TEXT,"
                + "gm_background TEXT,"
                + "area_id       INTEGER REFERENCES dungeon_areas(area_id) ON DELETE SET NULL,"
                + "concept_level_id INTEGER REFERENCES dungeon_concept_levels(concept_level_id) ON DELETE SET NULL"
                + ")");
        ensureColumn(stmt, "dungeon_rooms", "light_level", "TEXT");
        ensureColumn(stmt, "dungeon_rooms", "visual_description", "TEXT");
        ensureColumn(stmt, "dungeon_rooms", "sounds_description", "TEXT");
        ensureColumn(stmt, "dungeon_rooms", "smells_description", "TEXT");
        ensureColumn(stmt, "dungeon_rooms", "other_description", "TEXT");
        ensureColumn(stmt, "dungeon_rooms", "concept_level_id", "INTEGER REFERENCES dungeon_concept_levels(concept_level_id) ON DELETE SET NULL");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_squares ("
                + "square_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id         INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "x              INTEGER NOT NULL,"
                + "y              INTEGER NOT NULL,"
                + "terrain_type   TEXT NOT NULL DEFAULT 'room_floor',"
                + "room_id        INTEGER REFERENCES dungeon_rooms(room_id) ON DELETE SET NULL,"
                + "UNIQUE (map_id, x, y)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_concept_levels ("
                + "concept_level_id        INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id                  INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "sort_order              INTEGER NOT NULL,"
                + "start_level             INTEGER NOT NULL DEFAULT 1,"
                + "end_level               INTEGER NOT NULL DEFAULT 1,"
                + "progress_fraction       REAL NOT NULL DEFAULT 1.0,"
                + "adventuring_days_target REAL NOT NULL DEFAULT 1.0,"
                + "entrance_count          INTEGER NOT NULL DEFAULT 0,"
                + "exit_count              INTEGER NOT NULL DEFAULT 0,"
                + "UNIQUE (map_id, sort_order)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_concept_party_profiles ("
                + "map_id      INTEGER PRIMARY KEY REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "party_size  INTEGER NOT NULL DEFAULT 4"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_concept_level_connections ("
                + "concept_connection_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id                INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "level_a_id            INTEGER NOT NULL REFERENCES dungeon_concept_levels(concept_level_id) ON DELETE CASCADE,"
                + "level_b_id            INTEGER NOT NULL REFERENCES dungeon_concept_levels(concept_level_id) ON DELETE CASCADE,"
                + "CHECK(level_a_id <> level_b_id)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_concept_node_positions ("
                + "concept_position_id   INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id                INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "concept_level_id      INTEGER NOT NULL REFERENCES dungeon_concept_levels(concept_level_id) ON DELETE CASCADE,"
                + "node_key              TEXT NOT NULL,"
                + "node_type             TEXT NOT NULL CHECK(node_type IN ('entrance','exit','level_transition','room')),"
                + "entrance_index        INTEGER,"
                + "concept_connection_id INTEGER REFERENCES dungeon_concept_level_connections(concept_connection_id) ON DELETE CASCADE,"
                + "x                     REAL NOT NULL,"
                + "y                     REAL NOT NULL,"
                + "UNIQUE (map_id, concept_level_id, node_key)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_connections ("
                + "connection_id         INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id                INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "concept_level_id      INTEGER NOT NULL REFERENCES dungeon_concept_levels(concept_level_id) ON DELETE CASCADE,"
                + "left_node_key         TEXT NOT NULL,"
                + "right_node_key        TEXT NOT NULL,"
                + "CHECK(left_node_key <> right_node_key),"
                + "UNIQUE (concept_level_id, left_node_key, right_node_key)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_connection_points ("
                + "connection_point_id   INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "connection_id         INTEGER NOT NULL REFERENCES dungeon_connections(connection_id) ON DELETE CASCADE,"
                + "sort_order            INTEGER NOT NULL,"
                + "x                     INTEGER NOT NULL,"
                + "y                     INTEGER NOT NULL,"
                + "UNIQUE (connection_id, sort_order)"
                + ")");
        ensureColumn(stmt, "dungeon_concept_levels", "exit_count", "INTEGER NOT NULL DEFAULT 0");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_walls ("
                + "wall_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id       INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "x            INTEGER NOT NULL,"
                + "y            INTEGER NOT NULL,"
                + "direction    TEXT NOT NULL CHECK(direction IN ('east','south')),"
                + "UNIQUE (map_id, x, y, direction)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_features ("
                + "feature_id    INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id        INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "category      TEXT NOT NULL CHECK(category IN ('hazard','encounter','treasure','curiosity')),"
                + "encounter_id  INTEGER,"
                + "name          TEXT,"
                + "glance_description TEXT,"
                + "detail_description TEXT,"
                + "reactive_checks TEXT,"
                + "gm_background TEXT,"
                + "sort_order    INTEGER NOT NULL DEFAULT 0"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_feature_tiles ("
                + "feature_id    INTEGER NOT NULL REFERENCES dungeon_features(feature_id) ON DELETE CASCADE,"
                + "square_id     INTEGER NOT NULL REFERENCES dungeon_squares(square_id) ON DELETE CASCADE,"
                + "PRIMARY KEY (feature_id, square_id)"
                + ")");
    }

    public static void createIndexes(Statement stmt) throws SQLException {
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_squares_map ON dungeon_squares(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_rooms_map ON dungeon_rooms(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_areas_map ON dungeon_areas(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_area_encounter_tables_area ON dungeon_area_encounter_tables(area_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_area_encounter_tables_table ON dungeon_area_encounter_tables(table_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_concept_levels_map ON dungeon_concept_levels(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_concept_party_profiles_map ON dungeon_concept_party_profiles(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_concept_connections_map ON dungeon_concept_level_connections(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_concept_positions_map ON dungeon_concept_node_positions(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_concept_positions_level ON dungeon_concept_node_positions(concept_level_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_concept_positions_connection ON dungeon_concept_node_positions(concept_connection_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_connections_map ON dungeon_connections(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_connections_level ON dungeon_connections(concept_level_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_connection_points_connection ON dungeon_connection_points(connection_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_walls_map ON dungeon_walls(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_features_map ON dungeon_features(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_features_category ON dungeon_features(category)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_feature_tiles_square ON dungeon_feature_tiles(square_id)");
    }

    private static void ensureColumn(
            Statement stmt,
            String tableName,
            String columnName,
            String columnDefinition
    ) throws SQLException {
        SchemaCompatibility.ensureColumn(stmt.getConnection(), tableName, columnName, columnDefinition);
    }
}
