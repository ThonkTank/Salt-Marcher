package src.data.creatures.gateway.local;

import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class CreaturesColumnMigrationSupport {

    private CreaturesColumnMigrationSupport() {
    }

    static void ensureColumn(
            Connection connection,
            String tableName,
            String columnName,
            StatementCommand statementCommand
    ) throws SQLException {
        if (SqliteSchemaColumnSupport.hasColumn(connection, tableName, columnName)) {
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
