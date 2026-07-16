package features.items.adapter.sqlite;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.items.domain.catalog.ItemCatalogData;
import features.items.domain.importing.ImportedItem;
import features.items.domain.importing.ItemImportBatch;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

class SqliteItemCatalogAdapterTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void usesSharedLifecycleForQueriesBackupAndAtomicTableReplacement() {
        Path databasePath = temporaryDirectory.resolve("game.db");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteItemCatalogAdapter adapter = new SqliteItemCatalogAdapter(database);
            assertFalse(adapter.isAvailable());

            adapter.initialize();
            assertNotNull(adapter.createVerifiedBackup().createdAt());
            adapter.replaceAll(validBatch(List.of("Light")));

            assertTrue(adapter.isAvailable());
            ItemCatalogData.CatalogPage page = adapter.search(new ItemCatalogData.SearchSpec(
                    "club", "Weapon", "Simple", null, false, null, 0, 100,
                    ItemCatalogData.SortField.COST, false, 50, 0));
            assertEquals(1, page.totalCount());
            assertEquals("Club", page.rows().getFirst().name());
            assertEquals("Light", adapter.loadDetail("equipment:club").properties().getFirst());
            assertEquals(List.of("Adventuring Gear", "Weapon"),
                    adapter.loadFilterValues().categories());

            assertThrows(IllegalStateException.class,
                    () -> adapter.replaceAll(validBatch(List.of("Duplicate", "Duplicate"))));
            assertEquals("Club", adapter.loadDetail("equipment:club").row().name());
            assertEquals(2, adapter.search(new ItemCatalogData.SearchSpec(
                    null, null, null, null, null, null, null, null,
                    ItemCatalogData.SortField.NAME, true, 50, 0)).totalCount());
        }
    }

    private static ItemImportBatch validBatch(List<String> equipmentProperties) {
        return new ItemImportBatch(List.of(
                new ImportedItem(
                        "equipment:club", "Club", "Weapon", "Simple", false, "", false,
                        10, "1 sp", 2.0, "1d4 Bludgeoning", "", equipmentProperties,
                        "A wooden club.", "2014 SRD",
                        "https://www.dnd5eapi.co/api/2014/equipment/club"),
                new ImportedItem(
                        "magic-item:ring", "Ring", "Adventuring Gear", "Magic Item", true,
                        "Rare", true, null, "", null, "", "", List.of(),
                        "Requires attunement.", "2014 SRD",
                        "https://www.dnd5eapi.co/api/2014/magic-items/ring")));
    }
}
