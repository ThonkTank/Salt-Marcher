package features.encountertable.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import features.encountertable.adapter.sqlite.model.EncounterTablePersistenceSchema;

final class EncounterTableSchemaMigrator {

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLES_SQL);
            statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLE_ENTRIES_SQL);
            statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLE_LOOT_LINKS_SQL);
            statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLE_ENTRIES_TABLE_INDEX_SQL);
            statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLE_ENTRIES_CREATURE_INDEX_SQL);
        }
    }
}
