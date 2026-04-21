package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonTopologySeedRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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
                     "SELECT dungeon_map_id, name FROM dungeon_maps ORDER BY name COLLATE NOCASE, dungeon_map_id")) {
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
                     "SELECT dungeon_map_id, name FROM dungeon_maps ORDER BY dungeon_map_id LIMIT 1")) {
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
                     "SELECT dungeon_map_id, name FROM dungeon_maps WHERE dungeon_map_id=?")) {
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
                     "DELETE FROM dungeon_maps WHERE dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to delete dungeon map from SQLite.", exception);
        }
    }

    public long nextMapId() {
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO dungeon_maps(name) VALUES(?)",
                     Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, "Dungeon Map");
            statement.executeUpdate();
            try (ResultSet resultSet = statement.getGeneratedKeys()) {
                if (!resultSet.next()) {
                    throw new SQLException("No key returned for dungeon_maps insert");
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
                topologySeed(connection, mapId));
    }

    private DungeonTopologySeedRecord topologySeed(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT MIN(component_x) AS min_x, MIN(component_y) AS min_y,"
                        + " MAX(component_x) AS max_x, MAX(component_y) AS max_y"
                        + " FROM dungeon_rooms WHERE dungeon_map_id=?")) {
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
                "UPDATE dungeon_maps SET name=? WHERE dungeon_map_id=?")) {
            update.setString(1, record.name());
            update.setLong(2, record.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO dungeon_maps(dungeon_map_id, name) VALUES(?,?)")) {
            insert.setLong(1, record.mapId());
            insert.setString(2, record.name());
            insert.executeUpdate();
        }
    }

    private static void deleteMap(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "DELETE FROM dungeon_maps WHERE dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        }
    }

    private static void ensureSeedRoom(Connection connection, DungeonMapRecord record) throws SQLException {
        try (PreparedStatement count = connection.prepareStatement(
                "SELECT COUNT(*) FROM dungeon_rooms WHERE dungeon_map_id=?")) {
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
                "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z) VALUES(?,?,?,0)",
                Statement.RETURN_GENERATED_KEYS)) {
            insertCluster.setLong(1, record.mapId());
            insertCluster.setInt(2, seed.roomAnchorQ());
            insertCluster.setInt(3, seed.roomAnchorR());
            insertCluster.executeUpdate();
            try (ResultSet resultSet = insertCluster.getGeneratedKeys()) {
                if (!resultSet.next()) {
                    throw new SQLException("No key returned for dungeon_room_clusters insert");
                }
                clusterId = resultSet.getLong(1);
            }
        }
        try (PreparedStatement insertRoom = connection.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, component_x, component_y, level_z)"
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
