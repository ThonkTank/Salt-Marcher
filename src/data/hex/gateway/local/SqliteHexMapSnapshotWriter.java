package src.data.hex.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import src.data.hex.model.HexMapRecord;
import src.data.hex.model.HexMapSnapshotRecord;
import src.data.hex.model.HexMarkerRecord;
import src.data.hex.model.HexPersistenceSchema;
import src.data.hex.model.HexTerrainOverrideRecord;
import src.data.hex.model.HexTileRecord;

final class SqliteHexMapSnapshotWriter {

    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String DELETE_MARKERS_BY_MAP =
            "DELETE FROM " + HexPersistenceSchema.MARKERS_TABLE + " WHERE map_id = ?";
    private static final String DELETE_TERRAIN_BY_MAP =
            "DELETE FROM " + HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE + " WHERE map_id = ?";
    private static final String DELETE_TILES_BY_MAP =
            "DELETE FROM " + HexPersistenceSchema.TILES_TABLE + " WHERE map_id = ?";

    private SqliteHexMapSnapshotWriter() {
    }

    static void replaceSnapshot(
            Connection connection,
            long mapId,
            HexMapSnapshotRecord snapshot
    ) throws SQLException {
        saveMap(connection, snapshot.map());
        deleteExistingSnapshotRows(connection, mapId);
        insertTiles(connection, snapshot.tiles());
        insertTerrainOverrides(connection, snapshot.terrainOverrides());
        insertMarkers(connection, snapshot.markers());
    }

    private static void saveMap(Connection connection, HexMapRecord map) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + HexPersistenceSchema.MAPS_TABLE
                        + " (map_id, display_name, radius) VALUES (?, ?, ?) "
                        + "ON CONFLICT(map_id) DO UPDATE SET "
                        + "display_name = excluded.display_name, "
                        + "radius = excluded.radius, "
                        + "updated_at = CURRENT_TIMESTAMP")) {
            statement.setLong(1, map.mapId());
            statement.setString(2, map.displayName());
            statement.setInt(3, map.radius());
            statement.executeUpdate();
        }
    }

    private static void deleteExistingSnapshotRows(Connection connection, long mapId) throws SQLException {
        deleteByMap(connection, DELETE_MARKERS_BY_MAP, mapId);
        deleteByMap(connection, DELETE_TERRAIN_BY_MAP, mapId);
        deleteByMap(connection, DELETE_TILES_BY_MAP, mapId);
    }

    private static void insertTiles(
            Connection connection,
            List<HexTileRecord> tiles
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + HexPersistenceSchema.TILES_TABLE
                        + " (map_id, q, r) VALUES (?, ?, ?)")) {
            for (HexTileRecord tile : tiles) {
                statement.setLong(1, tile.mapId());
                statement.setInt(2, tile.q());
                statement.setInt(3, tile.r());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void insertTerrainOverrides(
            Connection connection,
            List<HexTerrainOverrideRecord> terrainOverrides
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE
                        + " (map_id, q, r, terrain) VALUES (?, ?, ?, ?)")) {
            for (HexTerrainOverrideRecord terrain : terrainOverrides) {
                statement.setLong(1, terrain.mapId());
                statement.setInt(2, terrain.q());
                statement.setInt(3, terrain.r());
                statement.setString(4, terrain.terrain());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void insertMarkers(
            Connection connection,
            List<HexMarkerRecord> markers
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + HexPersistenceSchema.MARKERS_TABLE
                        + " (map_id, marker_id, q, r, name, marker_type, note) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
            for (HexMarkerRecord marker : markers) {
                statement.setLong(1, marker.mapId());
                statement.setLong(2, marker.markerId());
                statement.setInt(3, marker.q());
                statement.setInt(4, marker.r());
                statement.setString(5, marker.name());
                statement.setString(6, marker.markerType());
                statement.setString(7, marker.note());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void deleteByMap(Connection connection, String sql, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        }
    }
}
