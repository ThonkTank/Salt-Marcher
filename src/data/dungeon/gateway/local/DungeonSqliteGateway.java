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
import src.data.dungeon.model.DungeonTopologySeedRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

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
                ensureSeedRoom(connection, record);
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
                loadCorridors(connection, mapId));
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
