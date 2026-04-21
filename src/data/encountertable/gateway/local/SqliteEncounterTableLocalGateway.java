package src.data.encountertable.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import src.data.encountertable.model.EncounterTableCandidateRecord;
import src.data.encountertable.model.EncounterTableSummaryRecord;

public final class SqliteEncounterTableLocalGateway {

    private final EncounterTableSqliteConnectionFactory connectionFactory;
    private final EncounterTableSchemaMigrator schemaMigrator;
    private final EncounterTableSqliteStore store = new EncounterTableSqliteStore();

    public SqliteEncounterTableLocalGateway() {
        this(new EncounterTableSqliteConnectionFactory(), new EncounterTableSchemaMigrator());
    }

    SqliteEncounterTableLocalGateway(
            EncounterTableSqliteConnectionFactory connectionFactory,
            EncounterTableSchemaMigrator schemaMigrator
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.schemaMigrator = Objects.requireNonNull(schemaMigrator, "schemaMigrator");
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
        Connection connection = connectionFactory.openConnection();
        try {
            schemaMigrator.ensureSchema(connection);
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
    }
}
