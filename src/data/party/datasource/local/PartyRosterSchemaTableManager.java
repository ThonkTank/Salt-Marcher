package src.data.party.datasource.local;

import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
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

    boolean hasColumn(Connection connection, String tableName, String columnName) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("PRAGMA table_info(" + tableName + ")");
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                if (columnName.equalsIgnoreCase(resultSet.getString("name"))) {
                    return true;
                }
            }
        }
        return false;
    }

    void ensureColumn(Connection connection, PartyPersistenceSchema.TableSpec table, String columnName) throws SQLException {
        PartyPersistenceSchema.ColumnSpec column = table.column(columnName);
        if (hasColumn(connection, table.name(), column.name())) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute("ALTER TABLE " + table.name() + " ADD COLUMN " + column.name() + " " + column.definition());
        }
    }
}
