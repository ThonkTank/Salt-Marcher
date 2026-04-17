package src.data.party.datasource.local;

import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

final class PartyRosterSchemaMigrator {

    private final PartyRosterSchemaTableManager tableManager = new PartyRosterSchemaTableManager();
    private final PartyRosterBackfillMigrator backfillMigrator = new PartyRosterBackfillMigrator();
    private final PartyRosterMetadataInitializer metadataInitializer = new PartyRosterMetadataInitializer();

    void ensureSchema(Connection connection) throws SQLException {
        tableManager.createBaseTables(connection);
        tableManager.ensureCharacterColumns(connection, List.of(
                "player_name",
                "passive_perception",
                "ac",
                "current_xp",
                "xp_since_long_rest",
                "xp_since_short_rest"));
        ensureShortRestCadenceColumn(connection);
        tableManager.ensureCharacterColumns(connection, List.of("in_party"));
        backfillMigrator.normalizeExistingXp(connection);
        metadataInitializer.initializeNextCharacterId(connection);
    }

    private void ensureShortRestCadenceColumn(Connection connection) throws SQLException {
        String columnName = "short_rests_taken_since_long_rest";
        if (tableManager.hasColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS.name(), columnName)) {
            return;
        }
        tableManager.ensureColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS, columnName);
        backfillMigrator.backfillShortRestCadence(connection);
    }
}
