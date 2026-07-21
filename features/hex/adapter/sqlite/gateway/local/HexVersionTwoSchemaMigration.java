package features.hex.adapter.sqlite.gateway.local;

import features.hex.adapter.sqlite.model.HexPersistenceSchema;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/** Repairs the released hybrid Hex-v1 shape without guessing at authored data. */
final class HexVersionTwoSchemaMigration {

    private static final String STAGED_MAPS = "sm_hex_v2_maps";
    private static final String STAGED_CURRENT_MAP = "sm_hex_v2_current_map";
    private static final String STAGED_TILES = "sm_hex_v2_tiles";
    private static final String STAGED_TERRAIN = "sm_hex_v2_terrain_overrides";
    private static final String STAGED_MARKERS = "sm_hex_v2_markers";
    private static final String ARCHIVED_MAPS = "sm_hex_v1_maps_archive";
    private static final String ARCHIVED_TILES = "sm_hex_v1_tiles_archive";
    private static final String SUPPORTED_TERRAIN =
            "('grassland','forest','mountain','mountains','water','desert','swamp')";
    private static final String SUPPORTED_MARKER_TYPES =
            "('SETTLEMENT','LANDMARK','DANGER','RESOURCE')";

    private static final List<ColumnSignature> LEGACY_MAP_COLUMNS = List.of(
            column("map_id", "INTEGER", false, null, 1),
            column("name", "TEXT", true, null, 0),
            column("is_bounded", "INTEGER", true, "0", 0),
            column("radius", "INTEGER", false, null, 0));
    private static final List<ColumnSignature> LEGACY_TILE_COLUMNS = List.of(
            column("tile_id", "INTEGER", false, null, 1),
            column("map_id", "INTEGER", true, null, 0),
            column("q", "INTEGER", true, null, 0),
            column("r", "INTEGER", true, null, 0),
            column("terrain_type", "TEXT", true, "'grassland'", 0),
            column("elevation", "INTEGER", true, "0", 0),
            column("biome", "TEXT", false, null, 0),
            column("is_explored", "INTEGER", true, "0", 0),
            column("dominant_faction_id", "INTEGER", false, null, 0),
            column("notes", "TEXT", false, null, 0));
    private static final List<ColumnSignature> CURRENT_MAP_COLUMNS = List.of(
            column("singleton_id", "INTEGER", false, null, 1),
            column("map_id", "INTEGER", false, null, 0));
    private static final List<ColumnSignature> TERRAIN_COLUMNS = List.of(
            column("map_id", "INTEGER", true, null, 1),
            column("q", "INTEGER", true, null, 2),
            column("r", "INTEGER", true, null, 3),
            column("terrain", "TEXT", true, null, 0));
    private static final List<ColumnSignature> MARKER_COLUMNS = List.of(
            column("map_id", "INTEGER", true, null, 1),
            column("marker_id", "INTEGER", true, null, 2),
            column("q", "INTEGER", true, null, 0),
            column("r", "INTEGER", true, null, 0),
            column("name", "TEXT", true, null, 0),
            column("marker_type", "TEXT", true, null, 0),
            column("note", "TEXT", false, null, 0));

    void repair(Connection connection) throws SQLException {
        Connection safeConnection = Objects.requireNonNull(connection, "connection");
        if (hasCurrentTargetSignature(safeConnection)) {
            return;
        }
        if (!hasKnownHybridSignature(safeConnection)) {
            throw failure("Hex v1 schema is neither the target nor the known hybrid signature.");
        }
        HexLegacyInboundSchema.validate(safeConnection);
        validateRepresentableTruth(safeConnection);
        rebuildTargetSchema(safeConnection);
    }

    private static boolean hasCurrentTargetSignature(Connection connection) {
        try {
            HexSqliteTargetSchema.validator().validate(connection);
            return true;
        } catch (SQLException invalidTarget) {
            return false;
        }
    }

    private static boolean hasKnownHybridSignature(Connection connection) throws SQLException {
        return columns(connection, HexPersistenceSchema.MAPS_TABLE).equals(LEGACY_MAP_COLUMNS)
                && columns(connection, HexPersistenceSchema.CURRENT_MAP_TABLE).equals(CURRENT_MAP_COLUMNS)
                && columns(connection, HexPersistenceSchema.TILES_TABLE).equals(LEGACY_TILE_COLUMNS)
                && columns(connection, HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE).equals(TERRAIN_COLUMNS)
                && columns(connection, HexPersistenceSchema.MARKERS_TABLE).equals(MARKER_COLUMNS)
                && hasIndex(connection, HexPersistenceSchema.TILES_TABLE,
                        "idx_hex_tiles_order", false, List.of("map_id", "q", "r"))
                && hasIndex(connection, HexPersistenceSchema.TILES_TABLE,
                        "idx_hex_tiles_map", false, List.of("map_id"))
                && hasIndex(connection, HexPersistenceSchema.TILES_TABLE,
                        "idx_hex_tiles_faction", false, List.of("dominant_faction_id"))
                && hasAnyIndex(connection, HexPersistenceSchema.TILES_TABLE,
                        true, List.of("map_id", "q", "r"))
                && hasIndex(connection, HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE,
                        "idx_hex_terrain_order", false, List.of("map_id", "q", "r"))
                && hasIndex(connection, HexPersistenceSchema.MARKERS_TABLE,
                        "idx_hex_markers_tile", false, List.of("map_id", "q", "r"));
    }

    private static void validateRepresentableTruth(Connection connection) throws SQLException {
        requireNoRows(connection,
                "SELECT 1 FROM hex_maps WHERE name IS NULL OR trim(name)='' OR is_bounded IS NULL "
                        + "OR is_bounded<>1 OR radius IS NULL OR radius<0 OR radius>99",
                "Hex v1 contains an unrepresentable map.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_tiles WHERE elevation<>0 OR (biome IS NOT NULL AND trim(biome)<>'') "
                        + "OR is_explored<>0 OR dominant_faction_id IS NOT NULL "
                        + "OR (notes IS NOT NULL AND trim(notes)<>'')",
                "Hex v1 contains tile truth that the target schema cannot represent.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_tiles WHERE terrain_type IS NULL "
                        + "OR lower(trim(terrain_type)) NOT IN " + SUPPORTED_TERRAIN,
                "Hex v1 contains an unknown terrain value.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_terrain_overrides WHERE terrain IS NULL "
                        + "OR lower(trim(terrain)) NOT IN " + SUPPORTED_TERRAIN,
                "Hex v1 contains an unknown terrain override.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_markers WHERE name IS NULL OR trim(name)='' "
                        + "OR marker_type NOT IN " + SUPPORTED_MARKER_TYPES,
                "Hex v1 contains an invalid marker.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_tiles t LEFT JOIN hex_maps m ON m.map_id=t.map_id "
                        + "WHERE m.map_id IS NULL OR max(abs(t.q),abs(t.r),abs(t.q+t.r))>m.radius",
                "Hex v1 contains an orphan or out-of-radius tile.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_maps m WHERE (SELECT COUNT(*) FROM hex_tiles t "
                        + "WHERE t.map_id=m.map_id) <> (3*m.radius*(m.radius+1)+1)",
                "Hex v1 tile coordinates do not completely cover their map radius.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_current_map c LEFT JOIN hex_maps m ON m.map_id=c.map_id "
                        + "WHERE c.singleton_id<>1 OR (c.map_id IS NOT NULL AND m.map_id IS NULL)",
                "Hex v1 contains an invalid current-map pointer.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_terrain_overrides o LEFT JOIN hex_tiles t "
                        + "ON t.map_id=o.map_id AND t.q=o.q AND t.r=o.r WHERE t.tile_id IS NULL",
                "Hex v1 contains an orphan terrain override.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_markers m LEFT JOIN hex_tiles t "
                        + "ON t.map_id=m.map_id AND t.q=m.q AND t.r=m.r WHERE t.tile_id IS NULL",
                "Hex v1 contains an orphan marker.");
        requireNoRows(connection,
                "SELECT 1 FROM hex_terrain_overrides o JOIN hex_tiles t "
                        + "ON t.map_id=o.map_id AND t.q=o.q AND t.r=o.r "
                        + "WHERE " + normalizedTerrain("o.terrain") + "<>" + normalizedTerrain("t.terrain_type"),
                "Hex v1 contains conflicting terrain truth.");
    }

    private static void rebuildTargetSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            createStagingTables(statement);
            copyRepresentableTruth(statement);
            archiveReferencedLegacyTables(statement);
            installStagedTables(statement);
            statement.execute(HexPersistenceSchema.CREATE_TILES_ORDER_INDEX_SQL);
            statement.execute(HexPersistenceSchema.CREATE_TERRAIN_ORDER_INDEX_SQL);
            statement.execute(HexPersistenceSchema.CREATE_MARKERS_TILE_INDEX_SQL);
        }
    }

    private static void createStagingTables(Statement statement) throws SQLException {
        statement.execute("CREATE TABLE " + STAGED_MAPS + " (map_id INTEGER PRIMARY KEY, "
                + "display_name TEXT NOT NULL, radius INTEGER NOT NULL, "
                + "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
        statement.execute("CREATE TABLE " + STAGED_CURRENT_MAP + " (singleton_id INTEGER PRIMARY KEY "
                + "CHECK (singleton_id=1), map_id INTEGER REFERENCES " + STAGED_MAPS
                + "(map_id) ON DELETE SET NULL)");
        statement.execute("CREATE TABLE " + STAGED_TILES + " (map_id INTEGER NOT NULL REFERENCES "
                + STAGED_MAPS + "(map_id) ON DELETE CASCADE, q INTEGER NOT NULL, r INTEGER NOT NULL, "
                + "PRIMARY KEY(map_id,q,r))");
        statement.execute("CREATE TABLE " + STAGED_TERRAIN + " (map_id INTEGER NOT NULL REFERENCES "
                + STAGED_MAPS + "(map_id) ON DELETE CASCADE, q INTEGER NOT NULL, r INTEGER NOT NULL, "
                + "terrain TEXT NOT NULL, PRIMARY KEY(map_id,q,r), FOREIGN KEY(map_id,q,r) REFERENCES "
                + STAGED_TILES + "(map_id,q,r) ON DELETE CASCADE)");
        statement.execute("CREATE TABLE " + STAGED_MARKERS + " (map_id INTEGER NOT NULL REFERENCES "
                + STAGED_MAPS + "(map_id) ON DELETE CASCADE, marker_id INTEGER NOT NULL, q INTEGER NOT NULL, "
                + "r INTEGER NOT NULL, name TEXT NOT NULL, marker_type TEXT NOT NULL, note TEXT, "
                + "PRIMARY KEY(map_id,marker_id), FOREIGN KEY(map_id,q,r) REFERENCES " + STAGED_TILES
                + "(map_id,q,r) ON DELETE CASCADE)");
    }

    private static void copyRepresentableTruth(Statement statement) throws SQLException {
        statement.execute("INSERT INTO " + STAGED_MAPS
                + "(map_id,display_name,radius) SELECT map_id,trim(name),radius FROM hex_maps");
        statement.execute("INSERT INTO " + STAGED_TILES
                + "(map_id,q,r) SELECT map_id,q,r FROM hex_tiles");
        statement.execute("INSERT INTO " + STAGED_CURRENT_MAP
                + "(singleton_id,map_id) SELECT singleton_id,map_id FROM hex_current_map");
        statement.execute("INSERT INTO " + STAGED_TERRAIN + "(map_id,q,r,terrain) "
                + "SELECT map_id,q,r," + normalizedTerrain("terrain_type")
                + " FROM hex_tiles WHERE " + normalizedTerrain("terrain_type") + "<>'GRASSLAND'");
        statement.execute("INSERT OR IGNORE INTO " + STAGED_TERRAIN + "(map_id,q,r,terrain) "
                + "SELECT map_id,q,r," + normalizedTerrain("terrain")
                + " FROM hex_terrain_overrides WHERE " + normalizedTerrain("terrain") + "<>'GRASSLAND'");
        statement.execute("INSERT INTO " + STAGED_MARKERS
                + "(map_id,marker_id,q,r,name,marker_type,note) "
                + "SELECT map_id,marker_id,q,r,name,marker_type,note FROM hex_markers");
    }

    private static void archiveReferencedLegacyTables(Statement statement) throws SQLException {
        statement.execute("DROP TABLE hex_current_map");
        statement.execute("DROP TABLE hex_terrain_overrides");
        statement.execute("DROP TABLE hex_markers");
        statement.execute("ALTER TABLE hex_maps RENAME TO " + ARCHIVED_MAPS);
        statement.execute("ALTER TABLE hex_tiles RENAME TO " + ARCHIVED_TILES);
        statement.execute("DROP INDEX idx_hex_tiles_order");
    }

    private static void installStagedTables(Statement statement) throws SQLException {
        statement.execute("ALTER TABLE " + STAGED_MAPS + " RENAME TO hex_maps");
        statement.execute("ALTER TABLE " + STAGED_TILES + " RENAME TO hex_tiles");
        statement.execute("ALTER TABLE " + STAGED_CURRENT_MAP + " RENAME TO hex_current_map");
        statement.execute("ALTER TABLE " + STAGED_TERRAIN + " RENAME TO hex_terrain_overrides");
        statement.execute("ALTER TABLE " + STAGED_MARKERS + " RENAME TO hex_markers");
    }

    private static String normalizedTerrain(String expression) {
        return "CASE lower(trim(" + expression + ")) "
                + "WHEN 'grassland' THEN 'GRASSLAND' WHEN 'forest' THEN 'FOREST' "
                + "WHEN 'mountain' THEN 'MOUNTAINS' WHEN 'mountains' THEN 'MOUNTAINS' "
                + "WHEN 'water' THEN 'WATER' WHEN 'desert' THEN 'DESERT' "
                + "WHEN 'swamp' THEN 'SWAMP' END";
    }

    private static void requireNoRows(Connection connection, String query, String message) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(query)) {
            if (result.next()) {
                throw failure(message);
            }
        }
    }

    private static List<ColumnSignature> columns(Connection connection, String table) throws SQLException {
        List<ColumnSignature> columns = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (result.next()) {
                columns.add(column(
                        result.getString("name"),
                        result.getString("type"),
                        result.getInt("notnull") == 1,
                        result.getString("dflt_value"),
                        result.getInt("pk")));
            }
        }
        return List.copyOf(columns);
    }

    private static boolean hasIndex(
            Connection connection,
            String table,
            String name,
            boolean unique,
            List<String> columns
    ) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA index_list(" + table + ")")) {
            while (result.next()) {
                if (name.equals(result.getString("name"))) {
                    return (result.getInt("unique") == 1) == unique
                            && indexColumns(connection, name).equals(columns);
                }
            }
        }
        return false;
    }

    private static boolean hasAnyIndex(
            Connection connection,
            String table,
            boolean unique,
            List<String> columns
    ) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA index_list(" + table + ")")) {
            while (result.next()) {
                if ((result.getInt("unique") == 1) == unique
                        && indexColumns(connection, result.getString("name")).equals(columns)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static List<String> indexColumns(Connection connection, String index) throws SQLException {
        List<String> columns = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA index_info(" + index + ")")) {
            while (result.next()) {
                columns.add(result.getString("name"));
            }
        }
        return List.copyOf(columns);
    }

    private static ColumnSignature column(
            String name,
            String type,
            boolean notNull,
            String defaultValue,
            int primaryKeyPosition
    ) {
        return new ColumnSignature(
                name,
                type == null ? "" : type.toUpperCase(Locale.ROOT),
                notNull,
                defaultValue,
                primaryKeyPosition);
    }

    private static SQLException failure(String message) {
        return new SQLException(message);
    }

    private record ColumnSignature(
            String name,
            String type,
            boolean notNull,
            String defaultValue,
            int primaryKeyPosition
    ) {
    }
}
