package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonClusterBoundaryRecord;
import src.data.dungeon.model.DungeonCorridorDoorBindingRecord;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonCorridorWaypointRecord;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.data.dungeon.model.DungeonRoomClusterVertexRecord;
import src.data.dungeon.model.DungeonRoomExitDescriptionRecord;
import src.data.dungeon.model.DungeonRoomFloorRecord;
import src.data.dungeon.model.DungeonRoomRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonStairExitRecord;
import src.data.dungeon.model.DungeonStairPathNodeRecord;
import src.data.dungeon.model.DungeonStairRecord;
import src.data.dungeon.model.DungeonTopologySeedRecord;
import src.data.dungeon.model.DungeonTransitionRecord;

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
import org.jspecify.annotations.Nullable;

public final class DungeonSqliteGateway {

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
                     "SELECT dungeon_map_id, name FROM "
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
                     "SELECT dungeon_map_id, name FROM "
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
                     "SELECT dungeon_map_id, name FROM "
                             + DungeonPersistenceSchema.MAPS_TABLE
                             + " WHERE dungeon_map_id=?")) {
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

    public DungeonMapRecord saveMap(DungeonMapRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("record must not be null");
        }
        try (Connection connection = openReadyConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                upsertMap(connection, record);
                if (record.roomClusters().isEmpty() && record.rooms().isEmpty()) {
                    ensureSeedRoom(connection, record);
                } else {
                    persistAuthoredGeometry(connection, record);
                }
                connection.commit();
                return record;
            } catch (SQLException exception) {
                connection.rollback();
                throw exception;
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
                     "DELETE FROM " + DungeonPersistenceSchema.MAPS_TABLE + " WHERE dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to delete dungeon map from SQLite.", exception);
        }
    }

    public long nextMapId() {
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO " + DungeonPersistenceSchema.MAPS_TABLE + "(name) VALUES(?)",
                     Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, "Dungeon Map");
            statement.executeUpdate();
            try (ResultSet resultSet = statement.getGeneratedKeys()) {
                if (!resultSet.next()) {
                    throw new SQLException("No key returned for " + DungeonPersistenceSchema.MAPS_TABLE + " insert");
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
        long mapId = resultSet.getLong("dungeon_map_id");
        return new DungeonMapRecord(
                mapId,
                resultSet.getString("name"),
                1L,
                topologySeed(connection, mapId),
                loadRoomClusters(connection, mapId),
                loadRooms(connection, mapId),
                loadCorridors(connection, mapId),
                loadStairs(connection, mapId),
                loadTransitions(connection, mapId));
    }

    private DungeonTopologySeedRecord topologySeed(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT MIN(component_x) AS min_x, MIN(component_y) AS min_y,"
                        + " MAX(component_x) AS max_x, MAX(component_y) AS max_y"
                        + " FROM " + DungeonPersistenceSchema.ROOMS_TABLE + " WHERE dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next() || resultSet.getObject("min_x") == null) {
                    return DungeonTopologySeedRecord.demo();
                }
                int minX = resultSet.getInt("min_x");
                int minY = resultSet.getInt("min_y");
                int maxX = resultSet.getInt("max_x");
                int maxY = resultSet.getInt("max_y");
                return new DungeonTopologySeedRecord(
                        Math.max(10, maxX + 6),
                        Math.max(8, maxY + 6),
                        minX,
                        minY);
            }
        }
    }

    private static void upsertMap(Connection connection, DungeonMapRecord record) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.MAPS_TABLE + " SET name=? WHERE dungeon_map_id=?")) {
            update.setString(1, record.name());
            update.setLong(2, record.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.MAPS_TABLE + "(dungeon_map_id, name) VALUES(?,?)")) {
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
        }
        deleteRowsNotIn(
                connection,
                DungeonPersistenceSchema.ROOMS_TABLE,
                "room_id",
                "dungeon_map_id",
                record.mapId(),
                roomIds);
        deleteRowsNotIn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                "cluster_id",
                "dungeon_map_id",
                record.mapId(),
                clusterIds);
    }

    private static void upsertRoomCluster(Connection connection, DungeonRoomClusterRecord cluster) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " SET center_x=?, center_y=?, level_z=? WHERE cluster_id=? AND dungeon_map_id=?")) {
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
                "INSERT INTO " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + "(cluster_id, dungeon_map_id, center_x, center_y, level_z) VALUES(?,?,?,?,?)")) {
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
                "DELETE FROM " + DungeonPersistenceSchema.ROOM_CLUSTER_VERTICES_TABLE + " WHERE cluster_id=?")) {
            delete.setLong(1, cluster.clusterId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.ROOM_CLUSTER_VERTICES_TABLE
                        + "(cluster_id, level_z, vertex_index, relative_x, relative_y) VALUES(?,?,?,?,?)")) {
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
                "DELETE FROM " + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE + " WHERE cluster_id=?")) {
            delete.setLong(1, cluster.clusterId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + "(cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type)"
                        + " VALUES(?,?,?,?,?,?)")) {
            for (DungeonClusterBoundaryRecord boundary : cluster.boundaries()) {
                insert.setLong(1, cluster.clusterId());
                insert.setInt(2, boundary.levelZ());
                insert.setInt(3, boundary.cellX());
                insert.setInt(4, boundary.cellY());
                insert.setString(5, boundary.edgeDirection());
                insert.setString(6, boundary.edgeType());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void upsertRoomPosition(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.ROOMS_TABLE
                        + " SET cluster_id=?, name=?, visual_description=?, component_x=?, component_y=?, level_z=?"
                        + " WHERE room_id=? AND dungeon_map_id=?")) {
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
                "INSERT INTO " + DungeonPersistenceSchema.ROOMS_TABLE
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

    private static void deleteRowsNotIn(
            Connection connection,
            String tableName,
            String idColumn,
            String mapIdColumn,
            long mapId,
            Set<Long> retainedIds
    ) throws SQLException {
        StringBuilder sql = new StringBuilder("DELETE FROM ")
                .append(tableName)
                .append(" WHERE ")
                .append(mapIdColumn)
                .append("=?");
        if (retainedIds != null && !retainedIds.isEmpty()) {
            sql.append(" AND ")
                    .append(idColumn)
                    .append(" NOT IN (")
                    .append("?,".repeat(retainedIds.size()));
            sql.setLength(sql.length() - 1);
            sql.append(')');
        }
        try (PreparedStatement delete = connection.prepareStatement(sql.toString())) {
            delete.setLong(1, mapId);
            int index = 2;
            for (Long retainedId : retainedIds == null ? Set.<Long>of() : retainedIds) {
                delete.setLong(index++, retainedId);
            }
            delete.executeUpdate();
        }
    }

    private static void replaceRoomFloors(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.ROOM_FLOORS_TABLE + " WHERE room_id=?")) {
            delete.setLong(1, room.roomId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.ROOM_FLOORS_TABLE
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

    private static List<DungeonRoomClusterRecord> loadRoomClusters(Connection connection, long mapId) throws SQLException {
        Map<Long, List<DungeonRoomClusterVertexRecord>> verticesByCluster = loadClusterVertices(connection, mapId);
        Map<Long, List<DungeonClusterBoundaryRecord>> boundariesByCluster = loadClusterBoundaries(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, center_x, center_y, level_z"
                        + " FROM " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
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
                            resultSet.getInt("level_z"),
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
                "SELECT cluster_id, level_z, vertex_index, relative_x, relative_y"
                        + " FROM " + DungeonPersistenceSchema.ROOM_CLUSTER_VERTICES_TABLE
                        + " WHERE cluster_id IN (SELECT cluster_id FROM "
                        + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, level_z, vertex_index")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonRoomClusterVertexRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long clusterId = resultSet.getLong("cluster_id");
                    records.computeIfAbsent(clusterId, ignored -> new ArrayList<>())
                            .add(new DungeonRoomClusterVertexRecord(
                                    clusterId,
                                    resultSet.getInt("level_z"),
                                    resultSet.getInt("vertex_index"),
                                    resultSet.getInt("relative_x"),
                                    resultSet.getInt("relative_y")));
                }
                return copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonClusterBoundaryRecord>> loadClusterBoundaries(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type"
                        + " FROM " + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + " WHERE cluster_id IN (SELECT cluster_id FROM "
                        + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, level_z, cell_y, cell_x, edge_direction")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonClusterBoundaryRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long clusterId = resultSet.getLong("cluster_id");
                    records.computeIfAbsent(clusterId, ignored -> new ArrayList<>())
                            .add(new DungeonClusterBoundaryRecord(
                                    clusterId,
                                    resultSet.getInt("level_z"),
                                    resultSet.getInt("cell_x"),
                                    resultSet.getInt("cell_y"),
                                    resultSet.getString("edge_direction"),
                                    resultSet.getString("edge_type")));
                }
                return copyGrouped(records);
            }
        }
    }

    private static List<DungeonRoomRecord> loadRooms(Connection connection, long mapId) throws SQLException {
        Map<Long, List<DungeonRoomFloorRecord>> floorsByRoom = loadRoomFloors(connection, mapId);
        Map<Long, List<DungeonRoomExitDescriptionRecord>> exitsByRoom = loadRoomExitDescriptions(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description, component_x, component_y, level_z"
                        + " FROM " + DungeonPersistenceSchema.ROOMS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY room_id")) {
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
                            resultSet.getInt("level_z"),
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
                        + " FROM " + DungeonPersistenceSchema.ROOM_FLOORS_TABLE
                        + " WHERE room_id IN (SELECT room_id FROM "
                        + DungeonPersistenceSchema.ROOMS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonRoomFloorRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long roomId = resultSet.getLong("room_id");
                    records.computeIfAbsent(roomId, ignored -> new ArrayList<>())
                            .add(new DungeonRoomFloorRecord(
                                    roomId,
                                    resultSet.getInt("level_z"),
                                    resultSet.getInt("anchor_x"),
                                    resultSet.getInt("anchor_y")));
                }
                return copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonRoomExitDescriptionRecord>> loadRoomExitDescriptions(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT room_id, cell_x, cell_y, edge_direction, description"
                        + " FROM " + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE
                        + " WHERE room_id IN (SELECT room_id FROM "
                        + DungeonPersistenceSchema.ROOMS_TABLE
                        + " WHERE dungeon_map_id=?)"
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
                return copyGrouped(records);
            }
        }
    }

    private static List<DungeonCorridorRecord> loadCorridors(Connection connection, long mapId) throws SQLException {
        Map<Long, List<Long>> roomIdsByCorridor = loadCorridorMembers(connection, mapId);
        Map<Long, List<DungeonCorridorWaypointRecord>> waypointsByCorridor = loadCorridorWaypoints(connection, mapId);
        Map<Long, List<DungeonCorridorDoorBindingRecord>> doorBindingsByCorridor =
                loadCorridorDoorBindings(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id, dungeon_map_id, level_z"
                        + " FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonCorridorRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.add(new DungeonCorridorRecord(
                            corridorId,
                            resultSet.getLong("dungeon_map_id"),
                            resultSet.getInt("level_z"),
                            roomIdsByCorridor.getOrDefault(corridorId, List.of()),
                            waypointsByCorridor.getOrDefault(corridorId, List.of()),
                            doorBindingsByCorridor.getOrDefault(corridorId, List.of())));
                }
                return List.copyOf(records);
            }
        }
    }

    private static Map<Long, List<Long>> loadCorridorMembers(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT c.corridor_id, m.room_id"
                        + " FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c"
                        + " LEFT JOIN " + DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE
                        + " m ON m.corridor_id=c.corridor_id"
                        + " WHERE c.dungeon_map_id=?"
                        + " ORDER BY c.corridor_id, m.member_order, m.room_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<Long>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.computeIfAbsent(corridorId, ignored -> new ArrayList<>());
                    long roomId = resultSet.getLong("room_id");
                    if (!resultSet.wasNull()) {
                        records.get(corridorId).add(roomId);
                    }
                }
                return copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonCorridorWaypointRecord>> loadCorridorWaypoints(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id, cluster_id, relative_x, relative_y, relative_z"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE
                        + " WHERE corridor_id IN (SELECT corridor_id FROM "
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorWaypointRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.computeIfAbsent(corridorId, ignored -> new ArrayList<>())
                            .add(new DungeonCorridorWaypointRecord(
                                    corridorId,
                                    resultSet.getLong("cluster_id"),
                                    resultSet.getInt("relative_x"),
                                    resultSet.getInt("relative_y"),
                                    resultSet.getInt("relative_z")));
                }
                return copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonCorridorDoorBindingRecord>> loadCorridorDoorBindings(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y, edge_direction"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE
                        + " WHERE corridor_id IN (SELECT corridor_id FROM "
                        + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order, room_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonCorridorDoorBindingRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long corridorId = resultSet.getLong("corridor_id");
                    records.computeIfAbsent(corridorId, ignored -> new ArrayList<>())
                            .add(new DungeonCorridorDoorBindingRecord(
                                    corridorId,
                                    resultSet.getLong("room_id"),
                                    resultSet.getLong("cluster_id"),
                                    resultSet.getInt("relative_cell_x"),
                                    resultSet.getInt("relative_cell_y"),
                                    resultSet.getString("edge_direction")));
                }
                return copyGrouped(records);
            }
        }
    }

    private static List<DungeonStairRecord> loadStairs(Connection connection, long mapId) throws SQLException {
        Map<Long, List<DungeonStairPathNodeRecord>> pathNodesByStair = loadStairPathNodes(connection, mapId);
        Map<Long, List<DungeonStairExitRecord>> exitsByStair = loadStairExits(connection, mapId);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT stair_id, dungeon_map_id, name, shape, direction, dimension1, dimension2, corridor_id"
                        + " FROM " + DungeonPersistenceSchema.STAIRS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY stair_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonStairRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    long stairId = resultSet.getLong("stair_id");
                    records.add(new DungeonStairRecord(
                            stairId,
                            resultSet.getLong("dungeon_map_id"),
                            resultSet.getString("name"),
                            resultSet.getString("shape"),
                            resultSet.getInt("direction"),
                            resultSet.getInt("dimension1"),
                            resultSet.getInt("dimension2"),
                            nullableLong(resultSet, "corridor_id"),
                            pathNodesByStair.getOrDefault(stairId, List.of()),
                            exitsByStair.getOrDefault(stairId, List.of())));
                }
                return List.copyOf(records);
            }
        }
    }

    private static Map<Long, List<DungeonStairPathNodeRecord>> loadStairPathNodes(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT stair_id, cell_x, cell_y, cell_z"
                        + " FROM " + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE
                        + " WHERE stair_id IN (SELECT stair_id FROM "
                        + DungeonPersistenceSchema.STAIRS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY stair_id, sort_order")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonStairPathNodeRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long stairId = resultSet.getLong("stair_id");
                    records.computeIfAbsent(stairId, ignored -> new ArrayList<>())
                            .add(new DungeonStairPathNodeRecord(
                                    stairId,
                                    resultSet.getInt("cell_x"),
                                    resultSet.getInt("cell_y"),
                                    resultSet.getInt("cell_z")));
                }
                return copyGrouped(records);
            }
        }
    }

    private static Map<Long, List<DungeonStairExitRecord>> loadStairExits(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT stair_id, stair_exit_id, cell_x, cell_y, cell_z, label"
                        + " FROM " + DungeonPersistenceSchema.STAIR_EXITS_TABLE
                        + " WHERE stair_id IN (SELECT stair_id FROM "
                        + DungeonPersistenceSchema.STAIRS_TABLE
                        + " WHERE dungeon_map_id=?)"
                        + " ORDER BY stair_id, stair_exit_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonStairExitRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long stairId = resultSet.getLong("stair_id");
                    records.computeIfAbsent(stairId, ignored -> new ArrayList<>())
                            .add(new DungeonStairExitRecord(
                                    stairId,
                                    resultSet.getLong("stair_exit_id"),
                                    resultSet.getInt("cell_x"),
                                    resultSet.getInt("cell_y"),
                                    resultSet.getInt("cell_z"),
                                    resultSet.getString("label")));
                }
                return copyGrouped(records);
            }
        }
    }

    private static List<DungeonTransitionRecord> loadTransitions(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y, level_z, destination_type,"
                        + " target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                        + " target_transition_id, linked_transition_id"
                        + " FROM " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY transition_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonTransitionRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    records.add(new DungeonTransitionRecord(
                            resultSet.getLong("transition_id"),
                            resultSet.getLong("dungeon_map_id"),
                            resultSet.getString("description"),
                            nullableInteger(resultSet, "cell_x"),
                            nullableInteger(resultSet, "cell_y"),
                            nullableInteger(resultSet, "level_z"),
                            resultSet.getString("destination_type"),
                            nullableLong(resultSet, "target_overworld_map_id"),
                            nullableLong(resultSet, "target_overworld_tile_id"),
                            nullableLong(resultSet, "target_dungeon_map_id"),
                            nullableLong(resultSet, "target_transition_id"),
                            nullableLong(resultSet, "linked_transition_id")));
                }
                return List.copyOf(records);
            }
        }
    }

    private static @Nullable Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    private static @Nullable Integer nullableInteger(ResultSet resultSet, String column) throws SQLException {
        int value = resultSet.getInt(column);
        return resultSet.wasNull() ? null : value;
    }

    private static <T> Map<Long, List<T>> copyGrouped(Map<Long, List<T>> records) {
        Map<Long, List<T>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<T>> entry : records.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static void deleteMap(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.MAPS_TABLE + " WHERE dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        }
    }

    private static void ensureSeedRoom(Connection connection, DungeonMapRecord record) throws SQLException {
        try (PreparedStatement count = connection.prepareStatement(
                "SELECT COUNT(*) FROM " + DungeonPersistenceSchema.ROOMS_TABLE + " WHERE dungeon_map_id=?")) {
            count.setLong(1, record.mapId());
            try (ResultSet resultSet = count.executeQuery()) {
                if (resultSet.next() && resultSet.getLong(1) > 0L) {
                    return;
                }
            }
        }
        long clusterId;
        DungeonTopologySeedRecord seed = record.topologySeed();
        try (PreparedStatement insertCluster = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + "(dungeon_map_id, center_x, center_y, level_z) VALUES(?,?,?,0)",
                Statement.RETURN_GENERATED_KEYS)) {
            insertCluster.setLong(1, record.mapId());
            insertCluster.setInt(2, seed.roomAnchorQ());
            insertCluster.setInt(3, seed.roomAnchorR());
            insertCluster.executeUpdate();
            try (ResultSet resultSet = insertCluster.getGeneratedKeys()) {
                if (!resultSet.next()) {
                    throw new SQLException(
                            "No key returned for " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE + " insert");
                }
                clusterId = resultSet.getLong(1);
            }
        }
        try (PreparedStatement insertRoom = connection.prepareStatement(
                "INSERT INTO "
                        + DungeonPersistenceSchema.ROOMS_TABLE
                        + "(dungeon_map_id, cluster_id, name, component_x, component_y, level_z)"
                        + " VALUES(?,?,?,?,?,0)")) {
            insertRoom.setLong(1, record.mapId());
            insertRoom.setLong(2, clusterId);
            insertRoom.setString(3, "Entry Hall");
            insertRoom.setInt(4, seed.roomAnchorQ());
            insertRoom.setInt(5, seed.roomAnchorR());
            insertRoom.executeUpdate();
        }
    }
}
