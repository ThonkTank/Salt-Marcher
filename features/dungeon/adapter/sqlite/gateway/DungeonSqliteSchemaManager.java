package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import features.dungeon.application.authored.port.DungeonIdentityKind;

final class DungeonSqliteSchemaManager {

    static final int CURRENT_SCHEMA_VERSION = 1;

    void initializeCurrentTarget(Connection connection) throws SQLException {
        rejectPreexistingDungeonShape(connection);
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
            for (String createIndexSql : DungeonPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(createIndexSql);
            }
        }
        initializeIdentitySequences(connection);
    }

    private static void rejectPreexistingDungeonShape(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT name FROM sqlite_master"
                        + " WHERE type IN ('table','view') AND name GLOB 'dungeon_*' LIMIT 1");
             var result = statement.executeQuery()) {
            if (result.next()) {
                throw new SQLException(
                        "Preexisting Dungeon development schema is not a supported current target: "
                                + result.getString(1));
            }
        }
    }

    private static void initializeIdentitySequences(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.IDENTITY_SEQUENCES_TABLE
                        + "(identity_kind, next_id) VALUES(?,1)")) {
            for (DungeonIdentityKind kind : DungeonIdentityKind.values()) {
                statement.setString(1, kind.name());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }
}
