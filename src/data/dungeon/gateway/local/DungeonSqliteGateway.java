package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonClusterBoundaryRecord;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.data.dungeon.model.DungeonRoomClusterVertexRecord;
import src.data.dungeon.model.DungeonRoomExitDescriptionRecord;
import src.data.dungeon.model.DungeonRoomFloorRecord;
import src.data.dungeon.model.DungeonRoomRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonGridBoundsRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public final class DungeonSqliteGateway {

    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String SQL_FROM = " FROM ";
    private static final String SQL_WHERE = " WHERE ";
    private static final String SELECT_MAP_COLUMNS = "SELECT dungeon_map_id, name";
    private static final String WHERE_DUNGEON_MAP_ID = SQL_WHERE + "dungeon_map_id=?";
    private static final String WHERE_DUNGEON_MAP_ID_SUBQUERY = SQL_WHERE + "dungeon_map_id=?)";
    private static final String COLUMN_DUNGEON_MAP_ID = "dungeon_map_id";
    private static final String COLUMN_CLUSTER_ID = "cluster_id";
    private static final String COLUMN_LEVEL_Z = "level_z";

    private final DungeonSqliteConnectionFactory connectionFactory;
    private final DungeonSqliteSchemaManager schemaManager;

    public DungeonSqliteGateway() {
        this(new DungeonSqliteConnectionFactory(), new DungeonSqliteSchemaManager());
    }

    DungeonSqliteGateway(
            DungeonSqliteConnectionFactory connectionFactory,
            DungeonSqliteSchemaManager schemaManager
    ) {
        this.connectionFactory = connectionFactory;
        this.schemaManager = schemaManager;
    }

    public List<DungeonMapRecord> searchMaps(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     SELECT_MAP_COLUMNS + SQL_FROM
                             + DungeonPersistenceSchema.MAPS_TABLE
                             + " ORDER BY name COLLATE NOCASE, dungeon_map_id")) {
            List<DungeonMapRecord> records = new ArrayList<>();
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    DungeonMapRecord record = toRecord(connection, resultSet);
                    if (normalized.isBlank() || record.name().toLowerCase(Locale.ROOT).contains(normalized)) {
                        records.add(record);
                    }
                }
            }
            return List.copyOf(records);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to search dungeon maps from SQLite.", exception);
        }
    }

    public Optional<DungeonMapRecord> firstMap() {
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     SELECT_MAP_COLUMNS + SQL_FROM
                             + DungeonPersistenceSchema.MAPS_TABLE
                             + " ORDER BY dungeon_map_id LIMIT 1")) {
            try (ResultSet resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    return Optional.of(toRecord(connection, resultSet));
                }
                return Optional.empty();
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load first dungeon map from SQLite.", exception);
        }
    }

    public Optional<DungeonMapRecord> findMap(long mapId) {
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     SELECT_MAP_COLUMNS + SQL_FROM
                             + DungeonPersistenceSchema.MAPS_TABLE
                             + WHERE_DUNGEON_MAP_ID)) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    return Optional.of(toRecord(connection, resultSet));
                }
                return Optional.empty();
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load dungeon map from SQLite.", exception);
        }
    }

    private Optional<DungeonMapRecord> findMap(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                SELECT_MAP_COLUMNS + SQL_FROM
                        + DungeonPersistenceSchema.MAPS_TABLE
                        + WHERE_DUNGEON_MAP_ID)) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    return Optional.of(toRecord(connection, resultSet));
                }
                return Optional.empty();
            }
        }
    }

    public DungeonMapRecord saveMap(DungeonMapRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("record must not be null");
        }
        try (Connection connection = openReadyConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                upsertMap(connection, record);
                persistAuthoredGeometry(connection, record);
                DungeonSqliteConnectionPersistence.persist(connection, record);
                DungeonSqliteTopologyElementGateway.persist(connection, record);
                connection.commit();
                return findMap(connection, record.mapId()).orElse(record);
            } catch (SQLException exception) {
                rollbackQuietly(connection);
                throw new IllegalStateException("Failed to save dungeon map to SQLite.", exception);
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save dungeon map to SQLite.", exception);
        }
    }

    public void deleteMap(long mapId) {
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     DELETE_FROM + DungeonPersistenceSchema.MAPS_TABLE + WHERE_DUNGEON_MAP_ID)) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to delete dungeon map from SQLite.", exception);
        }
    }

    public long nextMapId() {
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     INSERT_INTO + DungeonPersistenceSchema.MAPS_TABLE + "(name) VALUES(?)",
                     Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, "Dungeon Map");
            statement.executeUpdate();
            try (ResultSet resultSet = statement.getGeneratedKeys()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException(
                            "No key returned for " + DungeonPersistenceSchema.MAPS_TABLE + " insert");
                }
                long mapId = resultSet.getLong(1);
                deleteMap(connection, mapId);
                return mapId;
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to allocate dungeon map identity from SQLite.", exception);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        Connection connection = connectionFactory.openConnection();
        try {
            schemaManager.ensureSchema(connection);
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
    }

    private DungeonMapRecord toRecord(Connection connection, ResultSet resultSet) throws SQLException {
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

    private DungeonGridBoundsRecord gridBounds(Connection connection, long mapId) throws SQLException {
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

    private static void upsertMap(Connection connection, DungeonMapRecord record) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.MAPS_TABLE + " SET name=?" + WHERE_DUNGEON_MAP_ID)) {
            update.setString(1, record.name());
            update.setLong(2, record.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.MAPS_TABLE + "(dungeon_map_id, name) VALUES(?,?)")) {
            insert.setLong(1, record.mapId());
            insert.setString(2, record.name());
            insert.executeUpdate();
        }
    }

    private static void persistAuthoredGeometry(Connection connection, DungeonMapRecord record) throws SQLException {
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (DungeonRoomClusterRecord cluster : record.roomClusters()) {
            clusterIds.add(cluster.clusterId());
            upsertRoomCluster(connection, cluster);
            replaceClusterVertices(connection, cluster);
            replaceClusterBoundaries(connection, cluster);
        }
        Set<Long> roomIds = new LinkedHashSet<>();
        for (DungeonRoomRecord room : record.rooms()) {
            roomIds.add(room.roomId());
            upsertRoomPosition(connection, room);
            replaceRoomFloors(connection, room);
            replaceRoomExitDescriptions(connection, room);
        }
        DungeonSqliteStatementSupport.deleteObsoleteRooms(connection, record.mapId(), roomIds);
        DungeonSqliteStatementSupport.deleteObsoleteRoomClusters(connection, record.mapId(), clusterIds);
    }

    private static void upsertRoomCluster(Connection connection, DungeonRoomClusterRecord cluster) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " SET center_x=?, center_y=?, " + COLUMN_LEVEL_Z + "=? WHERE " + COLUMN_CLUSTER_ID
                        + "=? AND dungeon_map_id=?")) {
            update.setInt(1, cluster.centerX());
            update.setInt(2, cluster.centerY());
            update.setInt(3, cluster.levelZ());
            update.setLong(4, cluster.clusterId());
            update.setLong(5, cluster.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + "(" + COLUMN_CLUSTER_ID + ", dungeon_map_id, center_x, center_y, "
                        + COLUMN_LEVEL_Z + ") VALUES(?,?,?,?,?)")) {
            insert.setLong(1, cluster.clusterId());
            insert.setLong(2, cluster.mapId());
            insert.setInt(3, cluster.centerX());
            insert.setInt(4, cluster.centerY());
            insert.setInt(5, cluster.levelZ());
            insert.executeUpdate();
        }
    }

    private static void replaceClusterVertices(Connection connection, DungeonRoomClusterRecord cluster)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_VERTICES_TABLE + SQL_WHERE + COLUMN_CLUSTER_ID + "=?")) {
            delete.setLong(1, cluster.clusterId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_CLUSTER_VERTICES_TABLE
                        + "(" + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z
                        + ", vertex_index, relative_x, relative_y) VALUES(?,?,?,?,?)")) {
            for (DungeonRoomClusterVertexRecord vertex : cluster.vertices()) {
                insert.setLong(1, cluster.clusterId());
                insert.setInt(2, vertex.levelZ());
                insert.setInt(3, vertex.vertexIndex());
                insert.setInt(4, vertex.relativeX());
                insert.setInt(5, vertex.relativeY());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceClusterBoundaries(Connection connection, DungeonRoomClusterRecord cluster)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE + SQL_WHERE + COLUMN_CLUSTER_ID + "=?")) {
            delete.setLong(1, cluster.clusterId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + "(" + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z
                        + ", cell_x, cell_y, edge_direction, edge_type, topology_element_id)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            for (DungeonClusterBoundaryRecord boundary : cluster.boundaries()) {
                insert.setLong(1, cluster.clusterId());
                insert.setInt(2, boundary.levelZ());
                insert.setInt(3, boundary.cellX());
                insert.setInt(4, boundary.cellY());
                insert.setString(5, boundary.edgeDirection());
                insert.setString(6, boundary.edgeType());
                DungeonSqliteStatementSupport.setNullableLong(insert, 7, boundary.topologyElementId());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void upsertRoomPosition(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.ROOMS_TABLE
                        + " SET cluster_id=?, name=?, visual_description=?, component_x=?, component_y=?, level_z=?"
                        + SQL_WHERE + "room_id=? AND dungeon_map_id=?")) {
            update.setLong(1, room.clusterId());
            update.setString(2, room.name());
            update.setString(3, room.visualDescription());
            update.setInt(4, room.componentX());
            update.setInt(5, room.componentY());
            update.setInt(6, room.levelZ());
            update.setLong(7, room.roomId());
            update.setLong(8, room.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOMS_TABLE
                        + "(room_id, dungeon_map_id, cluster_id, name, visual_description, component_x, component_y, level_z)"
                        + " VALUES(?,?,?,?,?,?,?,?)")) {
            insert.setLong(1, room.roomId());
            insert.setLong(2, room.mapId());
            insert.setLong(3, room.clusterId());
            insert.setString(4, room.name());
            insert.setString(5, room.visualDescription());
            insert.setInt(6, room.componentX());
            insert.setInt(7, room.componentY());
            insert.setInt(8, room.levelZ());
            insert.executeUpdate();
        }
    }

    private static void replaceRoomFloors(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.ROOM_FLOORS_TABLE + SQL_WHERE + "room_id=?")) {
            delete.setLong(1, room.roomId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_FLOORS_TABLE
                        + "(room_id, level_z, anchor_x, anchor_y) VALUES(?,?,?,?)")) {
            for (DungeonRoomFloorRecord floor : room.floors()) {
                insert.setLong(1, room.roomId());
                insert.setInt(2, floor.levelZ());
                insert.setInt(3, floor.anchorX());
                insert.setInt(4, floor.anchorY());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceRoomExitDescriptions(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE + SQL_WHERE + "room_id=?")) {
            delete.setLong(1, room.roomId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE
                        + "(room_id, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonRoomExitDescriptionRecord exitDescription : room.exitDescriptions()) {
                insert.setLong(1, room.roomId());
                insert.setInt(2, exitDescription.cellX());
                insert.setInt(3, exitDescription.cellY());
                insert.setString(4, exitDescription.edgeDirection());
                insert.setString(5, exitDescription.description());
                insert.setInt(6, sortOrder);
                sortOrder++;
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static List<DungeonRoomClusterRecord> loadRoomClusters(Connection connection, long mapId) throws SQLException {
        Map<Long, List<DungeonRoomClusterVertexRecord>> verticesByCluster = loadClusterVertices(connection, mapId);
        Map<Long, List<DungeonClusterBoundaryRecord>> boundariesByCluster = loadClusterBoundaries(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, center_x, center_y, level_z"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + WHERE_DUNGEON_MAP_ID + " ORDER BY cluster_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonRoomClusterRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    long clusterId = resultSet.getLong("cluster_id");
                    records.add(new DungeonRoomClusterRecord(
                            clusterId,
                            resultSet.getLong("dungeon_map_id"),
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
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT " + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z + ", vertex_index, relative_x, relative_y"
                        + SQL_FROM + DungeonPersistenceSchema.ROOM_CLUSTER_VERTICES_TABLE
                        + SQL_WHERE + COLUMN_CLUSTER_ID + " IN (SELECT " + COLUMN_CLUSTER_ID + SQL_FROM
                        + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + WHERE_DUNGEON_MAP_ID_SUBQUERY
                        + " ORDER BY " + COLUMN_CLUSTER_ID + ", " + COLUMN_LEVEL_Z + ", vertex_index")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonRoomClusterVertexRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long clusterId = resultSet.getLong(COLUMN_CLUSTER_ID);
                    records.computeIfAbsent(clusterId, ignored -> new ArrayList<>())
                            .add(new DungeonRoomClusterVertexRecord(
                                    clusterId,
                                    resultSet.getInt(COLUMN_LEVEL_Z),
                                    resultSet.getInt("vertex_index"),
                                    resultSet.getInt("relative_x"),
                                    resultSet.getInt("relative_y")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
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
                            resultSet.getLong("dungeon_map_id"),
                            resultSet.getLong("cluster_id"),
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

    private static void deleteMap(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.MAPS_TABLE + WHERE_DUNGEON_MAP_ID)) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        }
    }

    private static void rollbackQuietly(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // Preserve the original storage failure that triggered the rollback.
        }
    }

}
