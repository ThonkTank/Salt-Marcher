package features.encountertable.adapter.sqlite.gateway.local;

import features.encountertable.adapter.sqlite.model.EncounterTableCandidateRecord;
import features.encountertable.adapter.sqlite.model.EncounterTableSummaryRecord;
import features.encountertable.adapter.sqlite.model.EncounterTablePersistenceSchema;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

public final class SqliteEncounterTableLocalGateway {

    private final FeatureStoreHandle connections;
    private final EncounterTableSqliteStore store = new EncounterTableSqliteStore();

    public static FeatureStoreDefinition storeDefinition() {
        EncounterTableSchemaMigrator schemaMigrator = new EncounterTableSchemaMigrator();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.builder()
                .table(EncounterTablePersistenceSchema.ENCOUNTER_TABLES)
                .primaryKey(EncounterTablePersistenceSchema.ENCOUNTER_TABLES_TABLE, "table_id")
                .table(EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES)
                .primaryKey(EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES_TABLE,
                        "table_id", "creature_id")
                .table(EncounterTablePersistenceSchema.ENCOUNTER_TABLE_LOOT_LINKS)
                .primaryKey(EncounterTablePersistenceSchema.ENCOUNTER_TABLE_LOOT_LINKS_TABLE, "table_id")
                .index("idx_encounter_table_entries_table",
                        EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES_TABLE, false, "table_id")
                .index("idx_encounter_table_entries_creature",
                        EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES_TABLE, false, "creature_id")
                .build();
        return FeatureStoreDefinition.validated(
                "encounter-table", targetSchema, new SqliteMigration(1, schemaMigrator::ensureSchema));
    }

    public SqliteEncounterTableLocalGateway(FeatureStoreHandle store) {
        this.connections = FeatureStoreHandle.requireOwner(store, "encounter-table");
    }

    public List<EncounterTableSummaryRecord> loadSummaries() {
        try (Connection connection = openReadyConnection()) {
            return store.loadSummaries(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load encounter tables from SQLite.", exception);
        }
    }

    public List<EncounterTableCandidateRecord> loadGenerationCandidates(List<Long> tableIds, int maximumXp) {
        try (Connection connection = openReadyConnection()) {
            return store.loadGenerationCandidates(connection, tableIds, maximumXp);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load encounter table candidates from SQLite.", exception);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
