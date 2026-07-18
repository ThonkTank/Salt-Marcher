package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomExitDescriptionRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonSqliteMapRecordLoader {

    private static final String SQL_FROM = " FROM ";
    private static final String SQL_WHERE = " WHERE ";
    private static final String WHERE_DUNGEON_MAP_ID = SQL_WHERE + "dungeon_map_id=?";
    private static final String COLUMN_DUNGEON_MAP_ID = "dungeon_map_id";
    private static final String COLUMN_CLUSTER_ID = "cluster_id";
    private static final String COLUMN_LEVEL_Z = "level_z";
    private static final String COLUMN_CELL_X = "cell_x";
    private static final String COLUMN_CELL_Y = "cell_y";
    private static final String ROOM_IDS_FOR_MAP_SUBQUERY = "(SELECT room_id" + SQL_FROM
            + DungeonPersistenceSchema.ROOMS_TABLE
            + WHERE_DUNGEON_MAP_ID + ")";

    private DungeonSqliteMapRecordLoader() {
    }

    static DungeonMapRecord load(Connection connection, ResultSet resultSet) throws SQLException {
        long mapId = resultSet.getLong(COLUMN_DUNGEON_MAP_ID);
        List<DungeonRoomRecord> rooms = loadRooms(connection, mapId);
        return new DungeonMapRecord(
                mapId,
                resultSet.getString("name"),
                resultSet.getLong("revision"),
                gridBounds(connection, mapId),
                loadRoomClusters(connection, mapId, rooms),
                rooms,
                DungeonSqliteTopologyElementGateway.load(connection, mapId),
                DungeonSqliteConnectionLoader.loadCorridors(connection, mapId),
                DungeonSqliteConnectionLoader.loadStairs(connection, mapId),
                DungeonSqliteConnectionLoader.loadTransitions(connection, mapId),
                loadFeatureMarkers(connection, mapId));
    }

    private static DungeonGridBoundsRecord gridBounds(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT MIN(c.cell_x) AS min_x, MIN(c.cell_y) AS min_y,"
                        + " MAX(c.cell_x) AS max_x, MAX(c.cell_y) AS max_y"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_CELLS_TABLE + " c"
                        + " JOIN " + DungeonPersistenceSchema.ROOMS_TABLE + " r ON r.room_id=c.room_id"
                        + SQL_WHERE + "r.dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next() || resultSet.getObject("min_x") == null) {
                    return DungeonGridBoundsRecord.defaultGrid();
                }
                int minX = resultSet.getInt("min_x");
                int minY = resultSet.getInt("min_y");
                int maxX = resultSet.getInt("max_x");
                int maxY = resultSet.getInt("max_y");
                return new DungeonGridBoundsRecord(
                        Math.max(10, maxX - Math.min(0, minX) + 6),
                        Math.max(8, maxY - Math.min(0, minY) + 6),
                        minX,
                        minY);
            }
        }
    }

    private static List<DungeonRoomClusterRecord> loadRoomClusters(
            Connection connection,
            long mapId,
            List<DungeonRoomRecord> rooms
    ) throws SQLException {
        Map<Long, List<DungeonClusterBoundaryRecord>> boundariesByCluster = loadClusterBoundaries(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, name"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + WHERE_DUNGEON_MAP_ID + " ORDER BY cluster_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonRoomClusterRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    long clusterId = resultSet.getLong(COLUMN_CLUSTER_ID);
                    DungeonRoomCellRecord center = derivedCenter(clusterId, rooms);
                    records.add(new DungeonRoomClusterRecord(
                            clusterId,
                            resultSet.getLong(COLUMN_DUNGEON_MAP_ID),
                            resultSet.getString("name"),
                            center.cellX(),
                            center.cellY(),
                            center.levelZ(),
                            boundariesByCluster.getOrDefault(clusterId, List.of())));
                }
                return List.copyOf(records);
            }
        }
    }

    private static DungeonRoomCellRecord derivedCenter(long clusterId, List<DungeonRoomRecord> rooms) {
        return rooms.stream()
                .filter(room -> room.clusterId() == clusterId)
                .flatMap(room -> room.floorCells().stream())
                .min(Comparator.comparingInt(DungeonRoomCellRecord::levelZ)
                        .thenComparingInt(DungeonRoomCellRecord::cellY)
                        .thenComparingInt(DungeonRoomCellRecord::cellX))
                .orElse(new DungeonRoomCellRecord(0L, 0, 0, 0));
    }

    private static Map<Long, List<DungeonClusterBoundaryRecord>> loadClusterBoundaries(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT " + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z
                        + ", " + COLUMN_CELL_X + ", " + COLUMN_CELL_Y
                        + ", edge_direction, edge_type, topology_element_id"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + WHERE_DUNGEON_MAP_ID
                        + " ORDER BY " + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z
                        + ", " + COLUMN_CELL_Y + ", " + COLUMN_CELL_X + ", edge_direction")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonClusterBoundaryRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long clusterId = resultSet.getLong(COLUMN_CLUSTER_ID);
                    records.computeIfAbsent(clusterId, ignored -> new ArrayList<>())
                            .add(new DungeonClusterBoundaryRecord(
                                    clusterId,
                                    resultSet.getInt(COLUMN_LEVEL_Z),
                                    resultSet.getInt(COLUMN_CELL_X),
                                    resultSet.getInt(COLUMN_CELL_Y),
                                    resultSet.getString("edge_direction"),
                                    resultSet.getString("edge_type"),
                                    DungeonSqliteStatementSupport.nullableLong(resultSet, "topology_element_id")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static List<DungeonRoomRecord> loadRooms(Connection connection, long mapId) throws SQLException {
        Map<Long, List<DungeonRoomCellRecord>> cellsByRoom = loadRoomCells(connection, mapId);
        Map<Long, List<DungeonRoomExitDescriptionRecord>> exitsByRoom = loadRoomExitDescriptions(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description"
                        + SQL_FROM + DungeonPersistenceSchema.ROOMS_TABLE
                        + WHERE_DUNGEON_MAP_ID + " ORDER BY room_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonRoomRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    long roomId = resultSet.getLong("room_id");
                    records.add(new DungeonRoomRecord(
                            roomId,
                            resultSet.getLong(COLUMN_DUNGEON_MAP_ID),
                            resultSet.getLong(COLUMN_CLUSTER_ID),
                            resultSet.getString("name"),
                            resultSet.getString("visual_description"),
                            cellsByRoom.getOrDefault(roomId, List.of()),
                            exitsByRoom.getOrDefault(roomId, List.of())));
                }
                return List.copyOf(records);
            }
        }
    }

    private static Map<Long, List<DungeonRoomCellRecord>> loadRoomCells(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT room_id, level_z, cell_x, cell_y"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_CELLS_TABLE
                        + SQL_WHERE + "room_id IN " + ROOM_IDS_FOR_MAP_SUBQUERY
                        + " ORDER BY room_id, level_z, cell_y, cell_x")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonRoomCellRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long roomId = resultSet.getLong("room_id");
                    records.computeIfAbsent(roomId, ignored -> new ArrayList<>())
                            .add(new DungeonRoomCellRecord(
                                    roomId,
                                    resultSet.getInt(COLUMN_LEVEL_Z),
                                    resultSet.getInt(COLUMN_CELL_X),
                                    resultSet.getInt(COLUMN_CELL_Y)));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static List<DungeonFeatureMarkerRecord> loadFeatureMarkers(Connection connection, long mapId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT feature_marker_id, dungeon_map_id, marker_kind, "
                        + COLUMN_CELL_X + ", " + COLUMN_CELL_Y + ", level_z, label, description"
                        + SQL_FROM + DungeonPersistenceSchema.FEATURE_MARKERS_TABLE
                        + WHERE_DUNGEON_MAP_ID + " ORDER BY feature_marker_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonFeatureMarkerRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    records.add(new DungeonFeatureMarkerRecord(
                            resultSet.getLong("feature_marker_id"),
                            resultSet.getLong(COLUMN_DUNGEON_MAP_ID),
                            resultSet.getString("marker_kind"),
                            resultSet.getInt(COLUMN_CELL_X),
                            resultSet.getInt(COLUMN_CELL_Y),
                            resultSet.getInt(COLUMN_LEVEL_Z),
                            resultSet.getString("label"),
                            resultSet.getString("description")));
                }
                return List.copyOf(records);
            }
        }
    }

    private static Map<Long, List<DungeonRoomExitDescriptionRecord>> loadRoomExitDescriptions(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT room_id, level_z, cell_x, cell_y, edge_direction, description"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE
                        + SQL_WHERE + "room_id IN " + ROOM_IDS_FOR_MAP_SUBQUERY
                        + " ORDER BY room_id, sort_order, level_z, cell_y, cell_x, edge_direction")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonRoomExitDescriptionRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long roomId = resultSet.getLong("room_id");
                    records.computeIfAbsent(roomId, ignored -> new ArrayList<>())
                            .add(new DungeonRoomExitDescriptionRecord(
                                    roomId,
                                    resultSet.getInt(COLUMN_LEVEL_Z),
                                    resultSet.getInt(COLUMN_CELL_X),
                                    resultSet.getInt(COLUMN_CELL_Y),
                                    resultSet.getString("edge_direction"),
                                    resultSet.getString("description")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }
}
