package features.hex.adapter.sqlite.gateway.local;

import features.hex.adapter.sqlite.model.HexPersistenceSchema;
import platform.persistence.SqliteSchemaValidator;

final class HexSqliteTargetSchema {

    private HexSqliteTargetSchema() {
    }

    static SqliteSchemaValidator validator() {
        return SqliteSchemaValidator.builder()
                .table(HexPersistenceSchema.MAPS_TABLE, "map_id", "display_name", "radius", "updated_at")
                .primaryKey(HexPersistenceSchema.MAPS_TABLE, "map_id")
                .table(HexPersistenceSchema.CURRENT_MAP_TABLE, "singleton_id", "map_id")
                .primaryKey(HexPersistenceSchema.CURRENT_MAP_TABLE, "singleton_id")
                .foreignKey(HexPersistenceSchema.CURRENT_MAP_TABLE, HexPersistenceSchema.MAPS_TABLE,
                        "SET NULL", SqliteSchemaValidator.reference("map_id", "map_id"))
                .table(HexPersistenceSchema.TILES_TABLE, "map_id", "q", "r")
                .primaryKey(HexPersistenceSchema.TILES_TABLE, "map_id", "q", "r")
                .foreignKey(HexPersistenceSchema.TILES_TABLE, HexPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("map_id", "map_id"))
                .table(HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE, "map_id", "q", "r", "terrain")
                .primaryKey(HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE, "map_id", "q", "r")
                .foreignKey(HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE, HexPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("map_id", "map_id"))
                .foreignKey(HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE, HexPersistenceSchema.TILES_TABLE,
                        "CASCADE",
                        SqliteSchemaValidator.reference("map_id", "map_id"),
                        SqliteSchemaValidator.reference("q", "q"),
                        SqliteSchemaValidator.reference("r", "r"))
                .table(HexPersistenceSchema.MARKERS_TABLE,
                        "map_id", "marker_id", "q", "r", "name", "marker_type", "note")
                .primaryKey(HexPersistenceSchema.MARKERS_TABLE, "map_id", "marker_id")
                .foreignKey(HexPersistenceSchema.MARKERS_TABLE, HexPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("map_id", "map_id"))
                .foreignKey(HexPersistenceSchema.MARKERS_TABLE, HexPersistenceSchema.TILES_TABLE,
                        "CASCADE",
                        SqliteSchemaValidator.reference("map_id", "map_id"),
                        SqliteSchemaValidator.reference("q", "q"),
                        SqliteSchemaValidator.reference("r", "r"))
                .index("idx_hex_tiles_order", HexPersistenceSchema.TILES_TABLE, false, "map_id", "q", "r")
                .index("idx_hex_terrain_order", HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE,
                        false, "map_id", "q", "r")
                .index("idx_hex_markers_tile", HexPersistenceSchema.MARKERS_TABLE,
                        false, "map_id", "q", "r")
                .build();
    }
}
