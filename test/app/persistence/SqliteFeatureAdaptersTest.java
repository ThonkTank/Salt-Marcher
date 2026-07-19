package app.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encountertable.adapter.sqlite.query.SqliteEncounterTableCatalogAdapter;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.nio.file.Path;
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
                    "encounter", 4,
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
