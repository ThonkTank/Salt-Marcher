package src.data.party.datasource.local;

import src.data.persistencecore.datasource.local.SqliteSchemaColumnSupport;
import src.data.persistencecore.model.SqliteTableSpec;
import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

final class PartyRosterSchemaTableManager {

    void createBaseTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(PartyPersistenceSchema.PLAYER_CHARACTERS.createTableSql());
            statement.execute(PartyPersistenceSchema.PARTY_ROSTER_METADATA.createTableSql());
            statement.execute(PartyPersistenceSchema.INITIALIZE_METADATA_SQL);
        }
    }

    void ensureCharacterColumns(Connection connection, List<String> columnNames) throws SQLException {
        for (String columnName : columnNames) {
            ensureColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS, columnName);
        }
    }

    void ensureColumn(Connection connection, SqliteTableSpec table, String columnName) throws SQLException {
        SqliteSchemaColumnSupport.ensureColumn(connection, table, columnName);
    }
}
