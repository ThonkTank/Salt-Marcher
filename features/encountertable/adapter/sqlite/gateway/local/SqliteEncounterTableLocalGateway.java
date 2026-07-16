package features.encountertable.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import features.encountertable.adapter.sqlite.model.EncounterTableCandidateRecord;
import features.encountertable.adapter.sqlite.model.EncounterTableSummaryRecord;

public final class SqliteEncounterTableLocalGateway {

    private final SqliteConnectionSource connections;
    private final EncounterTableSqliteStore store = new EncounterTableSqliteStore();

    public SqliteEncounterTableLocalGateway() {
        this(SqliteDatabase.defaultDatabase(
                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public SqliteEncounterTableLocalGateway(SqliteDatabase database) {
        EncounterTableSchemaMigrator schemaMigrator = new EncounterTableSchemaMigrator();
        this.connections = Objects.requireNonNull(database, "database").connections(
                "encounter-table",
                new SqliteMigration(1, schemaMigrator::ensureSchema));
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
