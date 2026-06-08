package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonClusterBoundaryRecord;
import src.data.dungeon.model.DungeonGridBoundsRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.data.dungeon.model.DungeonRoomClusterVertexRecord;
import src.data.dungeon.model.DungeonRoomExitDescriptionRecord;
import src.data.dungeon.model.DungeonRoomFloorRecord;
import src.data.dungeon.model.DungeonRoomRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonSqliteMapRecordLoader {

    private static final String SQL_FROM = " FROM ";
    private static final String SQL_WHERE = " WHERE ";
    private static final String WHERE_DUNGEON_MAP_ID = SQL_WHERE + "dungeon_map_id=?";
    private static final String WHERE_DUNGEON_MAP_ID_SUBQUERY = SQL_WHERE + "dungeon_map_id=?)";
    private static final String COLUMN_DUNGEON_MAP_ID = "dungeon_map_id";
    private static final String COLUMN_CLUSTER_ID = "cluster_id";
    private static final String COLUMN_LEVEL_Z = "level_z";

    private DungeonSqliteMapRecordLoader() {
    }

    static DungeonMapRecord load(Connection connection, ResultSet resultSet) throws SQLException {
        long mapId = resultSet.getLong(COLUMN_DUNGEON_MAP_ID);
        return new DungeonMapRecord(
                mapId,
                resultSet.getString("name"),
                1L,
                gridBounds(connection, mapId),
                loadRoomClusters(connection, mapId),
                loadRooms(connection, mapId),
                DungeonSqliteTopologyElementGateway.load(connection, mapId),
                DungeonSqliteConnectionLoader.loadCorridors(connection, mapId),
                DungeonSqliteConnectionLoader.loadStairs(connection, mapId),
                DungeonSqliteConnectionLoader.loadTransitions(connection, mapId));
    }

    private static DungeonGridBoundsRecord gridBounds(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT MIN(component_x) AS min_x, MIN(component_y) AS min_y,"
                        + " MAX(component_x) AS max_x, MAX(component_y) AS max_y"
                        + SQL_FROM + DungeonPersistenceSchema.ROOMS_TABLE + WHERE_DUNGEON_MAP_ID)) {
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
                        Math.max(10, maxX + 6),
                        Math.max(8, maxY + 6),
                        minX,
                        minY);
            }
        }
    }

    private static List<DungeonRoomClusterRecord> loadRoomClusters(Connection connection, long mapId) throws SQLException {
        Map<Long, List<DungeonRoomClusterVertexRecord>> verticesByCluster = loadClusterVertices(connection, mapId);
        Map<Long, List<DungeonClusterBoundaryRecord>> boundariesByCluster = loadClusterBoundaries(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, name, center_x, center_y, level_z"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + WHERE_DUNGEON_MAP_ID + " ORDER BY cluster_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonRoomClusterRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    long clusterId = resultSet.getLong(COLUMN_CLUSTER_ID);
                    records.add(new DungeonRoomClusterRecord(
                            clusterId,
                            resultSet.getLong(COLUMN_DUNGEON_MAP_ID),
                            resultSet.getString("name"),
                            resultSet.getInt("center_x"),
                            resultSet.getInt("center_y"),
                            resultSet.getInt(COLUMN_LEVEL_Z),
                            verticesByCluster.getOrDefault(clusterId, List.of()),
                            boundariesByCluster.getOrDefault(clusterId, List.of())));
                }
                return List.copyOf(records);
            }
        }
    }

    private static Map<Long, List<DungeonRoomClusterVertexRecord>> loadClusterVertices(
            Connection connection,
            long mapId
    ) throws SQLException {
        return DungeonSqliteClusterVertexLoader.load(connection, mapId);
    }

    private static Map<Long, List<DungeonClusterBoundaryRecord>> loadClusterBoundaries(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT " + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z
                        + ", cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + SQL_WHERE + COLUMN_CLUSTER_ID + " IN (SELECT " + COLUMN_CLUSTER_ID + SQL_FROM
                        + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
                        + " ORDER BY " + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z + ", cell_y, cell_x, edge_direction")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonClusterBoundaryRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long clusterId = resultSet.getLong(COLUMN_CLUSTER_ID);
                    records.computeIfAbsent(clusterId, ignored -> new ArrayList<>())
                            .add(new DungeonClusterBoundaryRecord(
                                    clusterId,
                                    resultSet.getInt(COLUMN_LEVEL_Z),
                                    resultSet.getInt("cell_x"),
                                    resultSet.getInt("cell_y"),
                                    resultSet.getString("edge_direction"),
                                    resultSet.getString("edge_type"),
                                    DungeonSqliteStatementSupport.nullableLong(resultSet, "topology_element_id")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static List<DungeonRoomRecord> loadRooms(Connection connection, long mapId) throws SQLException {
        Map<Long, List<DungeonRoomFloorRecord>> floorsByRoom = loadRoomFloors(connection, mapId);
        Map<Long, List<DungeonRoomExitDescriptionRecord>> exitsByRoom = loadRoomExitDescriptions(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description, component_x, component_y, level_z"
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
                            resultSet.getInt("component_x"),
                            resultSet.getInt("component_y"),
                            resultSet.getInt(COLUMN_LEVEL_Z),
                            floorsByRoom.getOrDefault(roomId, List.of()),
                            exitsByRoom.getOrDefault(roomId, List.of())));
                }
                return List.copyOf(records);
            }
        }
    }

    private static Map<Long, List<DungeonRoomFloorRecord>> loadRoomFloors(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT room_id, level_z, anchor_x, anchor_y"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_FLOORS_TABLE
                        + SQL_WHERE + "room_id IN (SELECT room_id" + SQL_FROM
                        + DungeonPersistenceSchema.ROOMS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
                        + " ORDER BY room_id, level_z")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonRoomFloorRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long roomId = resultSet.getLong("room_id");
                    records.computeIfAbsent(roomId, ignored -> new ArrayList<>())
                            .add(new DungeonRoomFloorRecord(
                                    roomId,
                                    resultSet.getInt(COLUMN_LEVEL_Z),
                                    resultSet.getInt("anchor_x"),
                                    resultSet.getInt("anchor_y")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonRoomExitDescriptionRecord>> loadRoomExitDescriptions(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT room_id, cell_x, cell_y, edge_direction, description"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE
                        + SQL_WHERE + "room_id IN (SELECT room_id" + SQL_FROM
                        + DungeonPersistenceSchema.ROOMS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
                        + " ORDER BY room_id, sort_order, cell_y, cell_x, edge_direction")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonRoomExitDescriptionRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long roomId = resultSet.getLong("room_id");
                    records.computeIfAbsent(roomId, ignored -> new ArrayList<>())
                            .add(new DungeonRoomExitDescriptionRecord(
                                    roomId,
                                    resultSet.getInt("cell_x"),
                                    resultSet.getInt("cell_y"),
                                    resultSet.getString("edge_direction"),
                                    resultSet.getString("description")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }
}
