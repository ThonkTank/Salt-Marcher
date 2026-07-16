package app.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encountertable.adapter.sqlite.query.SqliteEncounterTableCatalogAdapter;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;

final class SqliteFeatureAdaptersTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void sharesOneDatabaseAcrossFeatureAdaptersWithVersionedMigrations() throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("features.db"),
                NoopDiagnostics.INSTANCE)) {
            SqliteCreatureCatalogQueryAdapter creatures = new SqliteCreatureCatalogQueryAdapter(database);
            SqliteEncounterTableCatalogAdapter encounterTables = new SqliteEncounterTableCatalogAdapter(database);
            SqlitePartyRosterRepository party = new SqlitePartyRosterRepository(database);
            SqliteEncounterPlanRepository encounters = new SqliteEncounterPlanRepository(database);
            Map<String, Integer> expectedVersions = Map.of(
                    "creatures", 1,
                    "encounter", 3,
                    "encounter-table", 1,
                    "party", 1);

            creatures.loadFilterValues();
            encounterTables.loadSummaries();
            party.load();
            encounters.list();

            assertEquals(expectedVersions, featureVersions(database));

            creatures.loadFilterValues();
            encounterTables.loadSummaries();
            party.load();
            encounters.list();

            assertEquals(expectedVersions, featureVersions(database));
        }
    }

    private static Map<String, Integer> featureVersions(SqliteDatabase database) throws Exception {
        Map<String, Integer> versions = new LinkedHashMap<>();
        try (var connection = database.connections("test-inspection").openConnection();
             var result = connection.createStatement().executeQuery(
                     "SELECT owner, version FROM sm_schema_versions ORDER BY owner")) {
            while (result.next()) {
                versions.put(result.getString("owner"), result.getInt("version"));
            }
        }
        return versions;
    }
}
