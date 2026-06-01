package src.data.dungeon.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Objects;
import src.data.dungeon.model.DungeonPersistenceSchema;

final class DungeonSqliteIdentityReservation {

    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String RESERVE_MAP_SQL =
            INSERT_INTO + DungeonPersistenceSchema.MAPS_TABLE + "(name) VALUES(?)";
    private static final String RESERVE_STAIR_SQL =
            INSERT_INTO + DungeonPersistenceSchema.STAIRS_TABLE
                    + "(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                    + " VALUES(?,?,?,?,?,?)";
    private static final String RESERVE_TRANSITION_SQL =
            INSERT_INTO + DungeonPersistenceSchema.TRANSITIONS_TABLE
                    + "(dungeon_map_id, description, destination_type) VALUES(?,?,?)";
    private static final String RESERVATION_MAP_NAME = "SaltMarcher identity reservation";

    private final DungeonSqliteConnectionSupport connectionSupport;

    DungeonSqliteIdentityReservation(
            DungeonSqliteConnectionFactory connectionFactory,
            DungeonSqliteSchemaManager schemaManager
    ) {
        connectionSupport = new DungeonSqliteConnectionSupport(
                Objects.requireNonNull(connectionFactory, "connectionFactory"),
                Objects.requireNonNull(schemaManager, "schemaManager"));
    }

    long nextStairId() {
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return reserveFeatureId(connection, this::insertReservedStair);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to allocate dungeon stair identity from SQLite.", exception);
        }
    }

    long nextTransitionId() {
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return reserveFeatureId(connection, this::insertReservedTransition);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to allocate dungeon transition identity from SQLite.", exception);
        }
    }

    private long reserveFeatureId(
            Connection connection,
            FeatureReservation reservation
    ) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            long reservationMapId = insertReservationMap(connection);
            long featureId = reservation.reserve(connection, reservationMapId);
            DungeonSqliteMapRecordWriter.deleteMap(connection, reservationMapId);
            connection.commit();
            return featureId;
        } catch (SQLException exception) {
            rollbackQuietly(connection);
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private long insertReservationMap(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                RESERVE_MAP_SQL,
                Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, RESERVATION_MAP_NAME);
            statement.executeUpdate();
            return generatedKey(statement);
        }
    }

    private long insertReservedStair(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                RESERVE_STAIR_SQL,
                Statement.RETURN_GENERATED_KEYS)) {
            statement.setLong(1, mapId);
            statement.setString(2, RESERVATION_MAP_NAME);
            statement.setString(3, "STRAIGHT");
            statement.setInt(4, 0);
            statement.setInt(5, 1);
            statement.setInt(6, 1);
            statement.executeUpdate();
            return generatedKey(statement);
        }
    }

    private long insertReservedTransition(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                RESERVE_TRANSITION_SQL,
                Statement.RETURN_GENERATED_KEYS)) {
            statement.setLong(1, mapId);
            statement.setString(2, RESERVATION_MAP_NAME);
            statement.setString(3, "OVERWORLD_TILE");
            statement.executeUpdate();
            return generatedKey(statement);
        }
    }

    private static long generatedKey(Statement statement) throws SQLException {
        try (ResultSet resultSet = statement.getGeneratedKeys()) {
            if (!resultSet.next()) {
                throw new SQLException("No generated key returned for identity reservation.");
            }
            return resultSet.getLong(1);
        }
    }

    private static void rollbackQuietly(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // Preserve the original storage failure that triggered the rollback.
        }
    }

    @FunctionalInterface
    private interface FeatureReservation {
        long reserve(Connection connection, long mapId) throws SQLException;
    }
}
