package src.data.hex.model;

public final class HexPersistenceSchema {

    public static final String DATABASE_FILE_NAME = String.valueOf("game.db");
    public static final String MAPS_TABLE = "hex_maps";
    public static final String CURRENT_MAP_TABLE = "hex_current_map";
    public static final String TILES_TABLE = "hex_tiles";
    public static final String TERRAIN_OVERRIDES_TABLE = "hex_terrain_overrides";
    public static final String MARKERS_TABLE = "hex_markers";
    private static final String CREATE_TABLE_IF_NOT_EXISTS = "CREATE TABLE IF NOT EXISTS ";
    private static final String MAP_REFERENCE =
            "map_id INTEGER NOT NULL REFERENCES "
                    + MAPS_TABLE
                    + "(map_id) ON DELETE CASCADE, ";
    private static final String TILE_REFERENCE =
            "FOREIGN KEY(map_id, q, r) REFERENCES "
                    + TILES_TABLE
                    + "(map_id, q, r) ON DELETE CASCADE";

    public static final String CREATE_MAPS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + MAPS_TABLE + " ("
                    + "map_id INTEGER PRIMARY KEY, "
                    + "display_name TEXT NOT NULL, "
                    + "radius INTEGER NOT NULL, "
                    + "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")";

    public static final String CREATE_CURRENT_MAP_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + CURRENT_MAP_TABLE + " ("
                    + "singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1), "
                    + "map_id INTEGER REFERENCES " + MAPS_TABLE + "(map_id) ON DELETE SET NULL"
                    + ")";

    public static final String CREATE_TILES_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + TILES_TABLE + " ("
                    + MAP_REFERENCE
                    + "q INTEGER NOT NULL, "
                    + "r INTEGER NOT NULL, "
                    + "PRIMARY KEY(map_id, q, r)"
                    + ")";

    public static final String CREATE_TERRAIN_OVERRIDES_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + TERRAIN_OVERRIDES_TABLE + " ("
                    + MAP_REFERENCE
                    + "q INTEGER NOT NULL, "
                    + "r INTEGER NOT NULL, "
                    + "terrain TEXT NOT NULL, "
                    + "PRIMARY KEY(map_id, q, r), "
                    + TILE_REFERENCE
                    + ")";

    public static final String CREATE_MARKERS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + MARKERS_TABLE + " ("
                    + MAP_REFERENCE
                    + "marker_id INTEGER NOT NULL, "
                    + "q INTEGER NOT NULL, "
                    + "r INTEGER NOT NULL, "
                    + "name TEXT NOT NULL, "
                    + "marker_type TEXT NOT NULL, "
                    + "note TEXT, "
                    + "PRIMARY KEY(map_id, marker_id), "
                    + TILE_REFERENCE
                    + ")";

    public static final String CREATE_TILES_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_hex_tiles_order ON "
                    + TILES_TABLE + "(map_id, q, r)";

    public static final String CREATE_TERRAIN_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_hex_terrain_order ON "
                    + TERRAIN_OVERRIDES_TABLE + "(map_id, q, r)";

    public static final String CREATE_MARKERS_TILE_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_hex_markers_tile ON "
                    + MARKERS_TABLE + "(map_id, q, r)";

    private HexPersistenceSchema() {
    }
}
