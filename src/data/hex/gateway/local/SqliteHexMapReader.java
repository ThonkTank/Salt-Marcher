package src.data.hex.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import src.data.hex.model.HexMapRecord;
import src.data.hex.model.HexMapSnapshotRecord;
import src.data.hex.model.HexPersistenceSchema;

final class SqliteHexMapReader {

    private SqliteHexMapReader() {
    }

    static Optional<HexMapSnapshotRecord> loadSelected(Connection connection) throws SQLException {
        Optional<Long> selectedMapId = selectedMapId(connection);
        return selectedMapId.isEmpty() ? Optional.empty() : loadById(connection, selectedMapId.get());
    }

    static Optional<HexMapSnapshotRecord> loadById(Connection connection, long mapId) throws SQLException {
        Optional<HexMapRecord> map = loadMapRecord(connection, mapId);
        if (map.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new HexMapSnapshotRecord(
                map.get(),
                SqliteHexMapRecordReader.loadTiles(connection, mapId),
                SqliteHexMapRecordReader.loadTerrainOverrides(connection, mapId),
                SqliteHexMapRecordReader.loadMarkers(connection, mapId)));
    }

    static List<HexMapRecord> listMaps(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT map_id, display_name, radius FROM "
                        + HexPersistenceSchema.MAPS_TABLE
                        + " ORDER BY LOWER(display_name), map_id");
                ResultSet resultSet = statement.executeQuery()) {
            List<HexMapRecord> maps = new ArrayList<>();
            while (resultSet.next()) {
                maps.add(SqliteHexMapRecordReader.mapRecord(resultSet));
            }
            return List.copyOf(maps);
        }
    }

    static HexMapSnapshotRecord requireMap(Connection connection, long mapId) throws SQLException {
        Optional<HexMapSnapshotRecord> loaded = loadById(connection, mapId);
        if (loaded.isEmpty()) {
            throw new IllegalStateException("Hex map not found after write.");
        }
        return loaded.get();
    }

    static long nextMapId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT COALESCE(MAX(map_id), 0) + 1 AS next_map_id FROM "
                        + HexPersistenceSchema.MAPS_TABLE);
                ResultSet resultSet = statement.executeQuery()) {
            return resultSet.next() ? Math.max(1L, resultSet.getLong("next_map_id")) : 1L;
        }
    }

    static long nextMarkerId(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT COALESCE(MAX(marker_id), 0) + 1 AS next_marker_id FROM "
                        + HexPersistenceSchema.MARKERS_TABLE
                        + " WHERE map_id = ?")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next() ? Math.max(1L, resultSet.getLong("next_marker_id")) : 1L;
            }
        }
    }

    private static Optional<Long> selectedMapId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT map_id FROM "
                        + HexPersistenceSchema.CURRENT_MAP_TABLE
                        + " WHERE singleton_id = 1");
                ResultSet resultSet = statement.executeQuery()) {
            if (!resultSet.next()) {
                return Optional.empty();
            }
            long mapId = resultSet.getLong("map_id");
            return resultSet.wasNull() ? Optional.empty() : Optional.of(mapId);
        }
    }

    private static Optional<HexMapRecord> loadMapRecord(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT map_id, display_name, radius FROM "
                        + HexPersistenceSchema.MAPS_TABLE
                        + " WHERE map_id = ?")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return Optional.empty();
                }
                return Optional.of(SqliteHexMapRecordReader.mapRecord(resultSet));
            }
        }
    }
}
