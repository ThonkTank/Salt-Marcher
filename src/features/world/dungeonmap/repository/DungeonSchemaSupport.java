package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonLinkAnchorType;

import java.sql.SQLException;
import java.sql.Statement;

/**
 * Encapsulates dungeon-specific schema creation so bootstrap does not own the SQL details.
 */
public final class DungeonSchemaSupport {

    private static final String DUNGEON_PASSAGES_TABLE_COLUMNS = "("
            + "passage_id   INTEGER PRIMARY KEY AUTOINCREMENT,"
            + "map_id       INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
            + "x            INTEGER NOT NULL,"
            + "y            INTEGER NOT NULL,"
            + "direction    TEXT NOT NULL CHECK(direction IN ('east','south')),"
            + "name         TEXT,"
            + "notes        TEXT,"
            + "endpoint_id  INTEGER REFERENCES dungeon_endpoints(endpoint_id) ON DELETE SET NULL,"
            + "UNIQUE (map_id, x, y, direction)"
            + ")";
    private static final String DUNGEON_LINKS_TABLE_COLUMNS = "("
            + "link_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
            + "map_id             INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
            + "from_anchor_type   TEXT NOT NULL CHECK(from_anchor_type IN ('endpoint','passage')),"
            + "from_anchor_id     INTEGER NOT NULL,"
            + "to_anchor_type     TEXT NOT NULL CHECK(to_anchor_type IN ('endpoint','passage')),"
            + "to_anchor_id       INTEGER NOT NULL,"
            + "label              TEXT,"
            + "notes              TEXT,"
            + "CHECK ("
            + "CASE from_anchor_type "
            + "WHEN '" + canonicalAnchorTypeForSchema(DungeonLinkAnchorType.ENDPOINT) + "' THEN " + DungeonLinkAnchorType.ENDPOINT.persistenceOrder() + " "
            + "WHEN '" + canonicalAnchorTypeForSchema(DungeonLinkAnchorType.PASSAGE) + "' THEN " + DungeonLinkAnchorType.PASSAGE.persistenceOrder() + " "
            + "END < "
            + "CASE to_anchor_type "
            + "WHEN '" + canonicalAnchorTypeForSchema(DungeonLinkAnchorType.ENDPOINT) + "' THEN " + DungeonLinkAnchorType.ENDPOINT.persistenceOrder() + " "
            + "WHEN '" + canonicalAnchorTypeForSchema(DungeonLinkAnchorType.PASSAGE) + "' THEN " + DungeonLinkAnchorType.PASSAGE.persistenceOrder() + " "
            + "END "
            + "OR (from_anchor_type = to_anchor_type AND from_anchor_id < to_anchor_id)"
            + "),"
            + "UNIQUE (map_id, from_anchor_type, from_anchor_id, to_anchor_type, to_anchor_id)"
            + ")";

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
                + "encounter_table_id  INTEGER"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_rooms ("
                + "room_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id        INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name          TEXT NOT NULL,"
                + "description   TEXT,"
                + "area_id       INTEGER REFERENCES dungeon_areas(area_id) ON DELETE SET NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_squares ("
                + "square_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id         INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "x              INTEGER NOT NULL,"
                + "y              INTEGER NOT NULL,"
                + "terrain_type   TEXT NOT NULL DEFAULT 'room_floor',"
                + "room_id        INTEGER REFERENCES dungeon_rooms(room_id) ON DELETE SET NULL,"
                + "UNIQUE (map_id, x, y)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_endpoints ("
                + "endpoint_id    INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "map_id         INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "square_id      INTEGER NOT NULL REFERENCES dungeon_squares(square_id) ON DELETE CASCADE,"
                + "name           TEXT,"
                + "notes          TEXT,"
                + "role           TEXT NOT NULL DEFAULT 'both',"
                + "is_default_entry INTEGER NOT NULL DEFAULT 0,"
                + "UNIQUE (square_id)"
                + ")");
        stmt.execute(createDungeonLinksTableSql("dungeon_links", true));
        stmt.execute(createDungeonPassagesTableSql("dungeon_passages", true));
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
                + "notes         TEXT"
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
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_endpoints_map ON dungeon_endpoints(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_links_map ON dungeon_links(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_passages_map ON dungeon_passages(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_walls_map ON dungeon_walls(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_features_map ON dungeon_features(map_id)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_features_category ON dungeon_features(category)");
        stmt.execute("CREATE INDEX IF NOT EXISTS idx_dungeon_feature_tiles_square ON dungeon_feature_tiles(square_id)");
    }

    private static String createDungeonPassagesTableSql(String tableName, boolean ifNotExists) {
        return "CREATE TABLE " + (ifNotExists ? "IF NOT EXISTS " : "") + tableName + " " + DUNGEON_PASSAGES_TABLE_COLUMNS;
    }

    private static String createDungeonLinksTableSql(String tableName, boolean ifNotExists) {
        return "CREATE TABLE " + (ifNotExists ? "IF NOT EXISTS " : "") + tableName + " " + DUNGEON_LINKS_TABLE_COLUMNS;
    }

    static String canonicalAnchorTypeForSchema(DungeonLinkAnchorType type) {
        return switch (type) {
            case ENDPOINT -> "endpoint";
            case PASSAGE -> "passage";
        };
    }
}
