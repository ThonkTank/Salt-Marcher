package features.party.adapter.sqlite.gateway.local;

import platform.diagnostics.NoopDiagnostics;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteQueryCounter;
import features.party.adapter.sqlite.model.PartyRosterRecord;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * SQLite-backed local gateway for the party roster.
 */
public final class SqlitePartyLocalGateway {

    private static final DiagnosticId ROSTER_READ = new DiagnosticId("party.sqlite.roster-read");

    private final SqliteConnectionSource connections;
    private final PartyRosterSqliteStore store;
    private final Diagnostics diagnostics;

    public SqlitePartyLocalGateway() {
        this(SqliteDatabase.defaultDatabase(
                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public SqlitePartyLocalGateway(SqliteDatabase database) {
        this(database, NoopDiagnostics.INSTANCE);
    }

    public SqlitePartyLocalGateway(SqliteDatabase database, Diagnostics diagnostics) {
        PartyRosterSchemaMigrator schemaMigrator = new PartyRosterSchemaMigrator();
        this.connections = Objects.requireNonNull(database, "database").connections(
                "party",
                new SqliteMigration(1, schemaMigrator::ensureSchema));
        this.store = new PartyRosterSqliteStore();
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public PartyRosterRecord load() {
        long startedNanos = System.nanoTime();
        try {
            SqliteQueryCounter counted = new SqliteQueryCounter(connections.openConnection());
            try (Connection connection = counted.connection()) {
                PartyRosterRecord roster = store.load(connection);
                diagnostics.measurement(new Measurement(
                        ROSTER_READ,
                        0L,
                        Math.max(0L, System.nanoTime() - startedNanos),
                        roster.characters().size(),
                        counted.queryCount()));
                return roster;
            }
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
