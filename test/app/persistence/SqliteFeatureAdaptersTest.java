package app.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encountertable.adapter.sqlite.query.SqliteEncounterTableCatalogAdapter;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.LinkedHashMap;
import java.util.Map;

final class SqliteFeatureAdaptersTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void sharesOneDatabaseAcrossFeatureAdaptersWithVersionedMigrations() throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("features.db"),
                NoopDiagnostics.INSTANCE)) {
            var stores =
                    TestFeatureStores.stores(
                            database,
                            SqliteCreatureCatalogQueryAdapter.storeDefinition(),
                            SqliteEncounterTableCatalogAdapter.storeDefinition(),
                            SqlitePartyRosterRepository.storeDefinition(),
                            SqliteEncounterPlanRepository.storeDefinition());
            var creatureStore = stores.get("creatures");
            SqliteCreatureCatalogQueryAdapter creatures = new SqliteCreatureCatalogQueryAdapter(creatureStore);
            SqliteEncounterTableCatalogAdapter encounterTables = new SqliteEncounterTableCatalogAdapter(stores.get("encounter-table"));
            SqlitePartyRosterRepository party = new SqlitePartyRosterRepository(stores.get("party"));
            SqliteEncounterPlanRepository encounters = new SqliteEncounterPlanRepository(stores.get("encounter"));
            Map<String, Integer> expectedVersions = Map.of(
                    "creatures", 1,
                    "encounter", 5,
                    "encounter-table", 1,
                    "party", 1);

            creatures.loadFilterValues();
            encounterTables.loadSummaries();
            party.load();
            encounters.list();

            assertEquals(expectedVersions, featureVersions(creatureStore));

            creatures.loadFilterValues();
            encounterTables.loadSummaries();
            party.load();
            encounters.list();

            assertEquals(expectedVersions, featureVersions(creatureStore));
        }
    }

    @Test
    void malformedCurrentEncounterRuntimeSchemaFailsWithoutBlockingCreatures() throws Exception {
        Path databasePath = temporaryDirectory.resolve("malformed-encounter-runtime.db");
        try (SqliteDatabase initial = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            TestFeatureStores.stores(
                    initial,
                    SqliteEncounterPlanRepository.storeDefinition(),
                    SqliteCreatureCatalogQueryAdapter.storeDefinition());
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            connection.createStatement().execute("DROP TABLE encounter_runtime_result_enemies");
            connection.createStatement().execute(
                    "CREATE TABLE encounter_runtime_result_enemies(context_id TEXT PRIMARY KEY)");
        }

        try (SqliteDatabase current = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var encounter = current.featureStore(SqliteEncounterPlanRepository.storeDefinition());
            current.featureStore(SqliteCreatureCatalogQueryAdapter.storeDefinition());

            var readiness = current.prepareRegisteredStores();

            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED, readiness.get("encounter"));
            assertEquals(FeatureStoreReadiness.READY, readiness.get("creatures"));
            assertThrows(FeatureStoreUnavailableException.class, encounter::openConnection);
        }
    }

    private static Map<String, Integer> featureVersions(
            platform.persistence.FeatureStoreHandle store) throws Exception {
        Map<String, Integer> versions = new LinkedHashMap<>();
        try (var connection = store.openConnection();
             var result = connection.createStatement().executeQuery(
                                        "SELECT owner, version FROM sm_schema_versions ORDER BY"
                                            + " owner")) {
            while (result.next()) {
                versions.put(result.getString("owner"), result.getInt("version"));
            }
        }
        return versions;
    }
}
