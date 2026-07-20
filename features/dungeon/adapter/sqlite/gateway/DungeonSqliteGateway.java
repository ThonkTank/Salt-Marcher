package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.domain.core.structure.DungeonMapIdentity;

import platform.persistence.FeatureStoreHandle;

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

    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String SQL_FROM = " FROM ";
    private static final String SELECT_MAP_COLUMNS = "SELECT dungeon_map_id, name, revision";

    private final DungeonSqliteConnectionSupport connectionSupport;

    public DungeonSqliteGateway(FeatureStoreHandle store) {
        connectionSupport = new DungeonSqliteConnectionSupport(
                        FeatureStoreHandle.requireOwner(store, DungeonStoreDefinition.OWNER));
    }

    public List<DungeonMapHeader> searchMapHeaders(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        try (Connection connection = connectionSupport.openReadyConnection();
            PreparedStatement statement = connection.prepareStatement(
                     SELECT_MAP_COLUMNS + SQL_FROM
                             + DungeonPersistenceSchema.MAPS_TABLE
                             + " ORDER BY name COLLATE NOCASE, dungeon_map_id")) {
            List<DungeonMapHeader> records = new ArrayList<>();
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    DungeonMapHeader record = header(resultSet);
                    if (normalized.isBlank() || record.mapName().toLowerCase(Locale.ROOT).contains(normalized)) {
                        records.add(record);
                    }
                }
            }
            return List.copyOf(records);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to search dungeon maps from SQLite.", exception);
        }
    }

    public Optional<DungeonMapHeader> firstMapHeader() {
        try (Connection connection = connectionSupport.openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     SELECT_MAP_COLUMNS + SQL_FROM + DungeonPersistenceSchema.MAPS_TABLE
                             + " ORDER BY name COLLATE NOCASE, dungeon_map_id LIMIT"
                                        + " 1")) {
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next()
                        ? Optional.of(header(resultSet))
                        : Optional.empty();
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load first Dungeon map header from SQLite.", exception);
        }
    }

    public Optional<DungeonMapHeader> findMapHeader(long mapId) {
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return mapHeader(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load Dungeon map header from SQLite.", exception);
        }
    }

    public DungeonMapHeader createMapHeader(String mapName) {
        String safeName = requireMapName(mapName);
        try (Connection connection = connectionSupport.openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     INSERT_INTO + DungeonPersistenceSchema.MAPS_TABLE
                             + "(name, revision) VALUES(?,1)",
                     Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, safeName);
            statement.executeUpdate();
            try (ResultSet resultSet = statement.getGeneratedKeys()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException("No key returned for Dungeon map insert");
                }
                return new DungeonMapHeader(new DungeonMapIdentity(resultSet.getLong(1)), safeName, 1L);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to create Dungeon map header in SQLite.", exception);
        }
    }

    public DungeonMapHeader renameMapHeader(long mapId, String mapName) {
        String safeName = requireMapName(mapName);
        try (Connection connection = connectionSupport.openReadyConnection();
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE " + DungeonPersistenceSchema.MAPS_TABLE
                             + " SET name=?, revision=revision+1 WHERE"
                                        + " dungeon_map_id=?")) {
            update.setString(1, safeName);
            update.setLong(2, mapId);
            if (update.executeUpdate() == 0) {
                throw new IllegalArgumentException("Unknown Dungeon map: " + mapId);
            }
            return mapHeader(connection, mapId).orElseThrow(() ->
                    new IllegalStateException("Renamed Dungeon map header is missing: " + mapId));
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to rename Dungeon map header in SQLite.", exception);
        }
    }

    public void deleteMap(long mapId) {
        try (Connection connection = connectionSupport.openReadyConnection()) {
            DungeonSqliteMapRowDelete.delete(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to delete dungeon map from SQLite.", exception);
        }
    }

    private static Optional<DungeonMapHeader> mapHeader(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                SELECT_MAP_COLUMNS + SQL_FROM + DungeonPersistenceSchema.MAPS_TABLE
                        + " WHERE dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next()
                        ? Optional.of(header(resultSet))
                        : Optional.empty();
            }
        }
    }

    private static DungeonMapHeader header(ResultSet resultSet) throws SQLException {
        return new DungeonMapHeader(
                new DungeonMapIdentity(resultSet.getLong("dungeon_map_id")),
                resultSet.getString("name"),
                resultSet.getLong("revision"));
    }

    private static String requireMapName(String mapName) {
        if (mapName == null || mapName.isBlank()) {
            throw new IllegalArgumentException("mapName must not be blank");
        }
        return mapName.trim();
    }

}
