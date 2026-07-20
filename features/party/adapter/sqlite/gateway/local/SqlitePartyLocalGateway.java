package features.party.adapter.sqlite.gateway.local;

import platform.diagnostics.NoopDiagnostics;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.persistence.SqliteQueryCounter;
import features.party.adapter.sqlite.model.PartyRosterRecord;
import features.party.adapter.sqlite.model.PartyPersistenceSchema;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/** SQLite-backed local gateway for the party roster. */
public final class SqlitePartyLocalGateway {

    private static final DiagnosticId ROSTER_READ = new DiagnosticId("party.sqlite.roster-read");

    private final FeatureStoreHandle connections;
    private final PartyRosterSqliteStore store;
    private final Diagnostics diagnostics;

    public static FeatureStoreDefinition storeDefinition() {
        PartyRosterSchemaMigrator schemaMigrator = new PartyRosterSchemaMigrator();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.builder()
                .table(PartyPersistenceSchema.PLAYER_CHARACTERS)
                .primaryKey("player_characters", "id")
                .table(PartyPersistenceSchema.PARTY_ROSTER_METADATA)
                .primaryKey("party_roster_metadata", "singleton_id")
                .build();
        return FeatureStoreDefinition.validated(
                "party", targetSchema, new SqliteMigration(1, schemaMigrator::ensureSchema));
    }

    public SqlitePartyLocalGateway(FeatureStoreHandle store) {
        this(store, NoopDiagnostics.INSTANCE);
    }

    public SqlitePartyLocalGateway(FeatureStoreHandle store, Diagnostics diagnostics) {
        this.connections = FeatureStoreHandle.requireOwner(store, "party");
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
