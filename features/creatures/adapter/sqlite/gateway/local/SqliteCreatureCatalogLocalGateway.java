package features.creatures.adapter.sqlite.gateway.local;

import platform.diagnostics.NoopDiagnostics;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.persistence.SqliteQueryCounter;
import features.creatures.adapter.sqlite.model.CreatureCatalogPageRecord;
import features.creatures.adapter.sqlite.model.CreatureCatalogSearchCriteriaRecord;
import features.creatures.adapter.sqlite.model.CreatureDetailRecord;
import features.creatures.adapter.sqlite.model.CreatureFilterValuesRecord;
import features.creatures.adapter.sqlite.model.EncounterCandidateCriteriaRecord;
import features.creatures.adapter.sqlite.model.EncounterCandidateRecord;

import org.jspecify.annotations.Nullable;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

/** SQLite-backed local gateway for read-only creature catalog access. */
public final class SqliteCreatureCatalogLocalGateway {

    private static final DiagnosticId FACTS_READ = new DiagnosticId("creatures.sqlite.facts-read");

    private final FeatureStoreHandle connections;
    private final CreatureCatalogFilterValuesSqliteStore filterValuesStore = new CreatureCatalogFilterValuesSqliteStore();
    private final CreatureCatalogSearchSqliteStore catalogSearchStore = new CreatureCatalogSearchSqliteStore();
    private final CreatureDetailSqliteStore creatureDetailStore = new CreatureDetailSqliteStore();
    private final EncounterCandidateSqliteStore encounterCandidateStore = new EncounterCandidateSqliteStore();
    private final CreatureFactsSqliteStore creatureFactsStore = new CreatureFactsSqliteStore();
    private final Diagnostics diagnostics;

    public static FeatureStoreDefinition storeDefinition() {
        CreaturesSchemaMigrator schemaMigrator = new CreaturesSchemaMigrator();
        return FeatureStoreDefinition.of(
                        "creatures",
                        new SqliteMigration(1, schemaMigrator::ensureSchema));
    }

    public SqliteCreatureCatalogLocalGateway(FeatureStoreHandle store) {
        this(store, NoopDiagnostics.INSTANCE);
    }

    public SqliteCreatureCatalogLocalGateway(FeatureStoreHandle store, Diagnostics diagnostics) {
        this.connections = FeatureStoreHandle.requireOwner(store, "creatures");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public CreatureFilterValuesRecord loadFilterValues() {
        try (Connection connection = openReadyConnection()) {
            return filterValuesStore.loadFilterValues(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load creature filter values from SQLite.", exception);
        }
    }

    public CreatureCatalogPageRecord searchCatalog(CreatureCatalogSearchCriteriaRecord spec) {
        Objects.requireNonNull(spec, "spec");
        try (Connection connection = openReadyConnection()) {
            return catalogSearchStore.searchCatalog(connection, spec);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to search creatures in SQLite.", exception);
        }
    }

    public @Nullable CreatureDetailRecord loadCreatureDetail(long creatureId) {
        if (creatureId <= 0) {
            return null;
        }
        try (Connection connection = openReadyConnection()) {
            return creatureDetailStore.loadCreatureDetail(connection, creatureId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load creature detail from SQLite.", exception);
        }
    }

    public List<EncounterCandidateRecord> loadEncounterCandidates(EncounterCandidateCriteriaRecord spec) {
        Objects.requireNonNull(spec, "spec");
        try (Connection connection = openReadyConnection()) {
            return encounterCandidateStore.loadEncounterCandidates(connection, spec);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load encounter-ready creatures from SQLite.", exception);
        }
    }

    public List<EncounterCandidateRecord> loadCreatureFacts(
            features.creatures.domain.catalog.CreatureCatalogData.CreatureFactsSpec spec
    ) {
        Objects.requireNonNull(spec, "spec");
        long startedNanos = System.nanoTime();
        try {
            SqliteQueryCounter counted = new SqliteQueryCounter(openReadyConnection());
            try (Connection connection = counted.connection()) {
                List<EncounterCandidateRecord> facts = creatureFactsStore.load(connection, spec);
                diagnostics.measurement(new Measurement(
                        FACTS_READ,
                        0L,
                        Math.max(0L, System.nanoTime() - startedNanos),
                        facts.size(),
                        counted.queryCount()));
                return facts;
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load requested creature facts from SQLite.", exception);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
