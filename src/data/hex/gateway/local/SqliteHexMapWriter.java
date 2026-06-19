package src.data.hex.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import src.data.hex.model.HexMapSnapshotRecord;
import src.data.hex.model.HexMarkerRecord;
import src.data.hex.model.HexPersistenceSchema;

final class SqliteHexMapWriter {

    private static final String DEFAULT_TERRAIN = "GRASSLAND";
    private static final String INSERT_INTO = "INSERT INTO ";

    private SqliteHexMapWriter() {
    }

    static HexMapSnapshotRecord saveSnapshot(
            Connection connection,
            HexMapSnapshotRecord snapshot
    ) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            long mapId = snapshot.map().mapId();
            SqliteHexMapSnapshotWriter.replaceSnapshot(connection, mapId, snapshot);
            connection.commit();
            return SqliteHexMapReader.requireMap(connection, mapId);
        } catch (SQLException | IllegalStateException | IllegalArgumentException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    static void saveTerrain(
            Connection connection,
            long mapId,
            int q,
            int r,
            String terrain
    ) throws SQLException {
        if (DEFAULT_TERRAIN.equals(terrain)) {
            deleteTerrainOverride(connection, mapId, q, r);
        } else {
            upsertTerrainOverride(connection, mapId, q, r, terrain);
        }
    }

    static void saveMarker(Connection connection, HexMarkerRecord marker) throws SQLException {
        upsertMarker(connection, marker);
    }

    static void setSelectedMap(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + HexPersistenceSchema.CURRENT_MAP_TABLE
                        + " (singleton_id, map_id) VALUES (1, ?) "
                        + "ON CONFLICT(singleton_id) DO UPDATE SET map_id = excluded.map_id")) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        }
    }

    private static void upsertTerrainOverride(
            Connection connection,
            long mapId,
            int q,
            int r,
            String terrain
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE
                        + " (map_id, q, r, terrain) VALUES (?, ?, ?, ?) "
                        + "ON CONFLICT(map_id, q, r) DO UPDATE SET terrain = excluded.terrain")) {
            statement.setLong(1, mapId);
            statement.setInt(2, q);
            statement.setInt(3, r);
            statement.setString(4, terrain);
            statement.executeUpdate();
        }
    }

    private static void deleteTerrainOverride(
            Connection connection,
            long mapId,
            int q,
            int r
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "DELETE FROM "
                        + HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE
                        + " WHERE map_id = ? AND q = ? AND r = ?")) {
            statement.setLong(1, mapId);
            statement.setInt(2, q);
            statement.setInt(3, r);
            statement.executeUpdate();
        }
    }

    private static void upsertMarker(Connection connection, HexMarkerRecord marker) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + HexPersistenceSchema.MARKERS_TABLE
                        + " (map_id, marker_id, q, r, name, marker_type, note) VALUES (?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT(map_id, marker_id) DO UPDATE SET "
                        + "q = excluded.q, "
                        + "r = excluded.r, "
                        + "name = excluded.name, "
                        + "marker_type = excluded.marker_type, "
                        + "note = excluded.note")) {
            statement.setLong(1, marker.mapId());
            statement.setLong(2, marker.markerId());
            statement.setInt(3, marker.q());
            statement.setInt(4, marker.r());
            statement.setString(5, marker.name());
            statement.setString(6, marker.markerType());
            statement.setString(7, marker.note());
            statement.executeUpdate();
        }
    }

}
