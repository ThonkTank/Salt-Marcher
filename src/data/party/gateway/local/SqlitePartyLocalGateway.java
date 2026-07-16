package src.data.party.gateway.local;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import src.data.party.model.PartyRosterRecord;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * SQLite-backed local gateway for the party roster.
 */
public final class SqlitePartyLocalGateway {

    private final SqliteConnectionSource connections;
    private final PartyRosterSqliteStore store;

    public SqlitePartyLocalGateway() {
        this(SqliteDatabase.defaultDatabase(
                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public SqlitePartyLocalGateway(SqliteDatabase database) {
        PartyRosterSchemaMigrator schemaMigrator = new PartyRosterSchemaMigrator();
        this.connections = Objects.requireNonNull(database, "database").connections(
                "party",
                new SqliteMigration(1, schemaMigrator::ensureSchema));
        this.store = new PartyRosterSqliteStore();
    }

    public PartyRosterRecord load() {
        try (Connection connection = connections.openConnection()) {
            return store.load(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load party roster from SQLite.", exception);
        }
    }

    public void save(PartyRosterRecord rosterRecord) {
        Objects.requireNonNull(rosterRecord, "rosterRecord");
        try (Connection connection = connections.openConnection()) {
            store.save(connection, rosterRecord);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save party roster to SQLite.", exception);
        }
    }
}
