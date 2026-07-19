package features.encountertable.adapter.sqlite.gateway.local;

import features.encountertable.adapter.sqlite.model.EncounterTableCandidateRecord;
import features.encountertable.adapter.sqlite.model.EncounterTableSummaryRecord;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

public final class SqliteEncounterTableLocalGateway {

    private final FeatureStoreHandle connections;
    private final EncounterTableSqliteStore store = new EncounterTableSqliteStore();

    public static FeatureStoreDefinition storeDefinition() {
        EncounterTableSchemaMigrator schemaMigrator = new EncounterTableSchemaMigrator();
        return FeatureStoreDefinition.of(
                "encounter-table",
                new SqliteMigration(1, schemaMigrator::ensureSchema));
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
