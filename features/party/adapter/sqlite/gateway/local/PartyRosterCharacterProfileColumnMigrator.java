package features.party.adapter.sqlite.gateway.local;

import features.party.adapter.sqlite.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class PartyRosterCharacterProfileColumnMigrator {

    void ensureIdentityAndCombatColumns(Connection connection) throws SQLException {
        PartyRosterColumnMigrationSupport.ensureColumn(connection, "player_name",
                statement -> statement.execute(PartyPersistenceSchema.ADD_PLAYER_NAME_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(connection, "passive_perception",
                statement -> statement.execute(PartyPersistenceSchema.ADD_PASSIVE_PERCEPTION_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(connection, "ac",
                statement -> statement.execute(PartyPersistenceSchema.ADD_AC_COLUMN_SQL));
    }

    void ensureMembershipColumns(Connection connection) throws SQLException {
        PartyRosterColumnMigrationSupport.ensureColumn(connection, "in_party",
                statement -> statement.execute(PartyPersistenceSchema.ADD_IN_PARTY_COLUMN_SQL));
    }
}
