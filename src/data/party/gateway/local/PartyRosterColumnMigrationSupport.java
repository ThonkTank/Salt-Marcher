package src.data.party.gateway.local;

import platform.persistence.SqliteSchemaColumnSupport;
import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class PartyRosterColumnMigrationSupport {

    private static final String TABLE_NAME = PartyPersistenceSchema.PLAYER_CHARACTERS.name();

    private PartyRosterColumnMigrationSupport() {
    }

    static boolean hasColumn(Connection connection, String columnName) throws SQLException {
        return SqliteSchemaColumnSupport.hasColumn(connection, TABLE_NAME, columnName);
    }

    static void ensureColumn(
            Connection connection,
            String columnName,
            StatementCommand statementCommand
    ) throws SQLException {
        if (hasColumn(connection, columnName)) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statementCommand.execute(statement);
        }
    }

    @FunctionalInterface
    interface StatementCommand {
        void execute(Statement statement) throws SQLException;
    }
}
