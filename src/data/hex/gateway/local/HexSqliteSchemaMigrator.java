package src.data.hex.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import src.data.hex.model.HexPersistenceSchema;

final class HexSqliteSchemaMigrator {

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(HexPersistenceSchema.CREATE_MAPS_SQL);
            statement.execute(HexPersistenceSchema.CREATE_CURRENT_MAP_SQL);
            statement.execute(HexPersistenceSchema.CREATE_TILES_SQL);
            statement.execute(HexPersistenceSchema.CREATE_TERRAIN_OVERRIDES_SQL);
            statement.execute(HexPersistenceSchema.CREATE_MARKERS_SQL);
            statement.execute(HexPersistenceSchema.CREATE_TILES_ORDER_INDEX_SQL);
            statement.execute(HexPersistenceSchema.CREATE_TERRAIN_ORDER_INDEX_SQL);
            statement.execute(HexPersistenceSchema.CREATE_MARKERS_TILE_INDEX_SQL);
        }
    }
}
