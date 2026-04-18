package src.data.party.gateway.local;

import src.data.party.model.PartyRosterRecord;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * SQLite-backed local gateway for the party roster.
 */
public final class SqlitePartyLocalGateway {

    private final PartySqliteConnectionFactory connectionFactory;
    private final PartyRosterSchemaMigrator schemaMigrator;
    private final PartyRosterSqliteStore store;

    public SqlitePartyLocalGateway() {
        this(
                new PartySqliteConnectionFactory(),
                new PartyRosterSchemaMigrator(),
                new PartyRosterSqliteStore());
    }

    SqlitePartyLocalGateway(
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
