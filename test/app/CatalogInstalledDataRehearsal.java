package app;

import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogSearchSpec;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encountertable.adapter.sqlite.query.SqliteEncounterTableCatalogAdapter;
import features.items.adapter.sqlite.SqliteItemCatalogAdapter;
import features.items.domain.catalog.ItemCatalogData;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.SqliteDatabase;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/** Explicit executable proof for an owner-approved isolated copy of installed data. */
public final class CatalogInstalledDataRehearsal {

    private CatalogInstalledDataRehearsal() {}

    public static void main(String[] arguments) {
        Path databasePath = requireIsolatedCopy(arguments);
        if (!Files.isRegularFile(databasePath)) {
            throw new IllegalStateException(
                    "Rehearsal copy does not contain the installed database.");
        }
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            FeatureStoreManifest.Stores stores = FeatureStoreManifest.register(database);
            Map<String, FeatureStoreReadiness> readiness = database.prepareRegisteredStores();
            if (!readiness.keySet().equals(stores.owners())
                    || readiness.values().stream()
                            .anyMatch(value -> value != FeatureStoreReadiness.READY)) {
                throw new IllegalStateException(
                        "Rehearsal store preparation did not finish READY: " + readiness);
            }

            SqliteCreatureCatalogQueryAdapter creatures =
                    new SqliteCreatureCatalogQueryAdapter(stores.creatures());
            var creaturePage =
                    creatures.searchCatalog(
                            new CatalogSearchSpec(
                                    null, null, null, List.of(), List.of(), List.of(), List.of(),
                                    List.of(), "NAME", true, 1, 0));
            if (!creaturePage.rows().isEmpty()
                    && creatures.loadCreatureDetail(creaturePage.rows().getFirst().id()) == null) {
                throw new IllegalStateException("Creature detail semantic readback failed.");
            }

            SqliteItemCatalogAdapter items = new SqliteItemCatalogAdapter(stores.items());
            var itemPage =
                    items.search(
                            new ItemCatalogData.SearchSpec(
                                    null,
                                    null,
                                    null,
                                    null,
                                    null,
                                    null,
                                    null,
                                    null,
                                    ItemCatalogData.SortField.NAME,
                                    true,
                                    1,
                                    0));
            if (!itemPage.rows().isEmpty()
                    && items.loadDetail(itemPage.rows().getFirst().sourceKey()) == null) {
                throw new IllegalStateException("Item detail semantic readback failed.");
            }

            int savedEncounters =
                    new SqliteEncounterPlanRepository(stores.encounter()).list().size();
            var world = new SqliteWorldPlannerRepository(stores.worldPlanner()).load();
            int encounterTables =
                    new SqliteEncounterTableCatalogAdapter(stores.encounterTables())
                            .loadSummaries()
                            .size();

            System.out.printf(
                    "CATALOG_REHEARSAL_READY owners=%d creatures=%d items=%d saved_encounters=%d "
                            + "npcs=%d factions=%d locations=%d encounter_tables=%d%n",
                    readiness.size(),
                    creaturePage.totalCount(),
                    itemPage.totalCount(),
                    savedEncounters,
                    world.npcs().size(),
                    world.factions().size(),
                    world.locations().size(),
                    encounterTables);
        }
    }

    private static Path requireIsolatedCopy(String[] arguments) {
        if (arguments.length != 1) {
            throw new IllegalArgumentException(
                    "Catalog rehearsal requires one explicit absolute database-copy path.");
        }
        Path candidate = Path.of(arguments[0]);
        if (!candidate.isAbsolute()) {
            throw new IllegalArgumentException("Catalog rehearsal database path must be absolute.");
        }
        candidate = candidate.normalize();
        if (!Files.isRegularFile(candidate)) {
            throw new IllegalStateException("Catalog rehearsal database copy is missing.");
        }
        Path installed = SqliteDatabase.resolveDatabasePath(
                        SqliteDatabase.DEFAULT_DATABASE_FILE_NAME)
                .toAbsolutePath()
                .normalize();
        if (candidate.equals(installed)
                || (installed.getParent() != null && candidate.startsWith(installed.getParent()))) {
            throw new IllegalArgumentException(
                    "Catalog rehearsal refuses the installed application-data directory.");
        }
        try {
            if (Files.exists(installed) && candidate.toRealPath().equals(installed.toRealPath())) {
                throw new IllegalArgumentException(
                        "Catalog rehearsal refuses the installed database.");
            }
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Catalog rehearsal could not resolve database paths.", exception);
        }
        return candidate;
    }

}
