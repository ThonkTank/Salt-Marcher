package features.hex.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import features.hex.adapter.sqlite.model.HexMapRecord;
import features.hex.adapter.sqlite.model.HexMarkerRecord;
import features.hex.adapter.sqlite.model.HexPersistenceSchema;
import features.hex.adapter.sqlite.model.HexTerrainOverrideRecord;
import features.hex.adapter.sqlite.model.HexTileRecord;

final class SqliteHexMapRecordReader {

    private static final String MAP_ID_COLUMN = "map_id";
    private static final String Q_COLUMN = "q";
    private static final String R_COLUMN = "r";

    private SqliteHexMapRecordReader() {
    }

    static List<HexTileRecord> loadTiles(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT map_id, q, r FROM "
                        + HexPersistenceSchema.TILES_TABLE
                        + " WHERE map_id = ? ORDER BY q, r")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<HexTileRecord> tiles = new ArrayList<>();
                while (resultSet.next()) {
                    tiles.add(new HexTileRecord(
                            resultSet.getLong(MAP_ID_COLUMN),
                            resultSet.getInt(Q_COLUMN),
                            resultSet.getInt(R_COLUMN)));
                }
                return List.copyOf(tiles);
            }
        }
    }

    static List<HexTerrainOverrideRecord> loadTerrainOverrides(Connection connection, long mapId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT map_id, q, r, terrain FROM "
                        + HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE
                        + " WHERE map_id = ? ORDER BY q, r")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<HexTerrainOverrideRecord> terrain = new ArrayList<>();
                while (resultSet.next()) {
                    terrain.add(new HexTerrainOverrideRecord(
                            resultSet.getLong(MAP_ID_COLUMN),
                            resultSet.getInt(Q_COLUMN),
                            resultSet.getInt(R_COLUMN),
                            resultSet.getString("terrain")));
                }
                return List.copyOf(terrain);
            }
        }
    }

    static List<HexMarkerRecord> loadMarkers(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT map_id, marker_id, q, r, name, marker_type, note FROM "
                        + HexPersistenceSchema.MARKERS_TABLE
                        + " WHERE map_id = ? ORDER BY marker_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<HexMarkerRecord> markers = new ArrayList<>();
                while (resultSet.next()) {
                    markers.add(new HexMarkerRecord(
                            resultSet.getLong(MAP_ID_COLUMN),
                            resultSet.getLong("marker_id"),
                            resultSet.getInt(Q_COLUMN),
                            resultSet.getInt(R_COLUMN),
                            resultSet.getString("name"),
                            resultSet.getString("marker_type"),
                            resultSet.getString("note")));
                }
                return List.copyOf(markers);
            }
        }
    }

    static HexMapRecord mapRecord(ResultSet resultSet) throws SQLException {
        return new HexMapRecord(
                resultSet.getLong(MAP_ID_COLUMN),
                resultSet.getString("display_name"),
                resultSet.getInt("radius"));
    }
}
