package src.data.party.gateway.local;

import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class PartyRosterCharacterProgressColumnMigrator {

    void ensureXpColumns(Connection connection) throws SQLException {
        PartyRosterColumnMigrationSupport.ensureColumn(connection, "current_xp",
                statement -> statement.execute(PartyPersistenceSchema.ADD_CURRENT_XP_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(connection, "xp_since_long_rest",
                statement -> statement.execute(PartyPersistenceSchema.ADD_XP_SINCE_LONG_REST_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(connection, "xp_since_short_rest",
                statement -> statement.execute(PartyPersistenceSchema.ADD_XP_SINCE_SHORT_REST_COLUMN_SQL));
    }

    boolean hasShortRestCadenceColumn(Connection connection) throws SQLException {
        return PartyRosterColumnMigrationSupport.hasColumn(connection, "short_rests_taken_since_long_rest");
    }

    void ensureShortRestCadenceColumn(Connection connection) throws SQLException {
        PartyRosterColumnMigrationSupport.ensureColumn(connection, "short_rests_taken_since_long_rest",
                statement -> statement.execute(PartyPersistenceSchema.ADD_SHORT_RESTS_TAKEN_SINCE_LONG_REST_COLUMN_SQL));
    }
}
