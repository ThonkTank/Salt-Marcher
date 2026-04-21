package src.data.party.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;

final class PartyRosterSchemaMigrator {

    private final PartyRosterSchemaTableManager tableManager = new PartyRosterSchemaTableManager();
    private final PartyRosterCharacterProfileColumnMigrator profileColumnMigrator =
            new PartyRosterCharacterProfileColumnMigrator();
    private final PartyRosterCharacterProgressColumnMigrator progressColumnMigrator =
            new PartyRosterCharacterProgressColumnMigrator();
    private final PartyRosterCharacterTravelColumnMigrator travelColumnMigrator =
            new PartyRosterCharacterTravelColumnMigrator();
    private final PartyRosterBackfillMigrator backfillMigrator = new PartyRosterBackfillMigrator();
    private final PartyRosterMetadataInitializer metadataInitializer = new PartyRosterMetadataInitializer();

    void ensureSchema(Connection connection) throws SQLException {
        tableManager.createBaseTables(connection);
        profileColumnMigrator.ensureIdentityAndCombatColumns(connection);
        progressColumnMigrator.ensureXpColumns(connection);
        ensureShortRestCadenceColumn(connection);
        profileColumnMigrator.ensureMembershipColumns(connection);
        travelColumnMigrator.ensureTravelColumns(connection);
        backfillMigrator.normalizeExistingXp(connection);
        metadataInitializer.initializeNextCharacterId(connection);
    }

    private void ensureShortRestCadenceColumn(Connection connection) throws SQLException {
        if (progressColumnMigrator.hasShortRestCadenceColumn(connection)) {
            return;
        }
        progressColumnMigrator.ensureShortRestCadenceColumn(connection);
        backfillMigrator.backfillShortRestCadence(connection);
    }
}
