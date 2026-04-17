package src.data.party.datasource.local;

import src.data.party.model.PartyRosterRecord;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * SQLite-backed local storage for the party roster.
 */
public final class SqlitePartyLocalDataSource {

    private final PartySqliteConnectionFactory connectionFactory;
    private final PartyRosterSchemaMigrator schemaMigrator;
    private final PartyRosterSqliteStore store;

    public SqlitePartyLocalDataSource() {
        this(
                new PartySqliteConnectionFactory(),
                new PartyRosterSchemaMigrator(),
                new PartyRosterSqliteStore());
    }

    SqlitePartyLocalDataSource(
            PartySqliteConnectionFactory connectionFactory,
            PartyRosterSchemaMigrator schemaMigrator,
            PartyRosterSqliteStore store
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.schemaMigrator = Objects.requireNonNull(schemaMigrator, "schemaMigrator");
        this.store = Objects.requireNonNull(store, "store");
    }

    public PartyRosterRecord load() {
        try (Connection connection = connectionFactory.openConnection()) {
            schemaMigrator.ensureSchema(connection);
            return store.load(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load party roster from SQLite.", exception);
        }
    }

    public void save(PartyRosterRecord rosterRecord) {
        Objects.requireNonNull(rosterRecord, "rosterRecord");
        try (Connection connection = connectionFactory.openConnection()) {
            schemaMigrator.ensureSchema(connection);
            store.save(connection, rosterRecord);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save party roster to SQLite.", exception);
        }
    }
}
