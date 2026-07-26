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
        EncounterTableCurrentSchemaInitializer schemaInitializer =
                new EncounterTableCurrentSchemaInitializer();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.exactSchema(
                EncounterTablePersistenceSchema.CREATE_TABLE_SQL,
                EncounterTablePersistenceSchema.CREATE_INDEX_SQL,
                List.of("encounter_table", "idx_encounter_table"),
                List.of());
        return FeatureStoreDefinition.validated(
                "encounter-table", targetSchema,
                new SqliteMigration(1, schemaInitializer::initializeCurrent));
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
