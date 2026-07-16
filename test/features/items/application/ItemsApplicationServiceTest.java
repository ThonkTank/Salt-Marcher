package features.items.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import features.items.api.ItemsCatalogApi.CatalogStatus;
import features.items.api.ItemsCatalogApi.ItemQuery;
import features.items.api.ItemsCatalogApi.PageResult;
import features.items.api.ItemsCatalogApi.SortField;
import features.items.api.ItemsImportApi.ImportStatus;
import features.items.domain.catalog.ItemCatalogData;
import features.items.domain.catalog.ItemCatalogPort;
import features.items.domain.importing.ImportedItem;
import features.items.domain.importing.ItemImportBatch;
import features.items.domain.importing.ItemImportStore;
import features.items.domain.importing.PublicItemSource;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.ExecutionLane;

class ItemsApplicationServiceTest {

    @Test
    void catalogStorageRunsOnlyOnTheExecutionLaneAndReportsTypedStates() {
        QueuedLane lane = new QueuedLane();
        FakeCatalog catalog = new FakeCatalog(false);
        ItemsApplicationService service = service(catalog, List.of(), new RecordingStore(), lane);

        CompletionStage<PageResult> pending = service.search(ItemQuery.firstPage());

        assertFalse(pending.toCompletableFuture().isDone());
        assertEquals(0, catalog.searchCalls);
        lane.runNext();
        assertEquals(CatalogStatus.UNAVAILABLE,
                pending.toCompletableFuture().join().status());
        assertEquals(0, catalog.searchCalls);
    }

    @Test
    void invalidCostRangeNeverReachesStorage() {
        QueuedLane lane = new QueuedLane();
        FakeCatalog catalog = new FakeCatalog(true);
        ItemsApplicationService service = service(catalog, completeFeed(), new RecordingStore(), lane);

        var pending = service.search(invertedCostQuery());
        lane.runNext();

        assertEquals(CatalogStatus.INVALID_QUERY, pending.toCompletableFuture().join().status());
        assertEquals(0, catalog.searchCalls);
    }

    @Test
    void importValidatesBothFeedsBeforeBackupAndReplacement() {
        QueuedLane lane = new QueuedLane();
        RecordingStore store = new RecordingStore();
        ItemsApplicationService service = service(new FakeCatalog(true), completeFeed(), store, lane);

        var pending = service.importPublicSrd();
        lane.runNext();

        assertEquals(ImportStatus.SUCCESS, pending.toCompletableFuture().join().status());
        assertEquals(List.of("initialize", "backup", "replace:2"), store.events);
    }

    @Test
    void incompletePublicFeedCannotTouchSQLite() {
        QueuedLane lane = new QueuedLane();
        RecordingStore store = new RecordingStore();
        ItemsApplicationService service = service(
                new FakeCatalog(true),
                List.of(equipment("club", List.of("Light"))),
                store,
                lane);

        var pending = service.importPublicSrd();
        lane.runNext();

        assertEquals(ImportStatus.VALIDATION_ERROR, pending.toCompletableFuture().join().status());
        assertEquals(List.of(), store.events);
    }

    private static ItemsApplicationService service(
            ItemCatalogPort catalog,
            List<ImportedItem> items,
            ItemImportStore store,
            ExecutionLane lane
    ) {
        PublicItemSource source = () -> items;
        return new ItemsApplicationService(catalog, source, store, lane, NoopDiagnostics.INSTANCE);
    }

    private static ItemQuery invertedCostQuery() {
        return new ItemQuery(null, null, null, null, null, null,
                500, 100, SortField.COST, true, 50, 0);
    }

    private static List<ImportedItem> completeFeed() {
        return List.of(
                equipment("club", List.of("Light")),
                new ImportedItem(
                        "magic-item:adamantine-armor", "Adamantine Armor", "Armor", "Magic Item",
                        true, "Uncommon", false, null, "", null, "", "", List.of(),
                        "Armor.", "2014 SRD",
                        "https://www.dnd5eapi.co/api/2014/magic-items/adamantine-armor"));
    }

    private static ImportedItem equipment(String key, List<String> properties) {
        return new ImportedItem(
                "equipment:" + key, "Club", "Weapon", "Simple", false, "", false,
                10, "1 sp", 2.0, "1d4 Bludgeoning", "", properties,
                "A wooden club.", "2014 SRD",
                "https://www.dnd5eapi.co/api/2014/equipment/" + key);
    }

    private static final class FakeCatalog implements ItemCatalogPort {
        private final boolean available;
        private int searchCalls;

        private FakeCatalog(boolean available) {
            this.available = available;
        }

        @Override
        public boolean isAvailable() {
            return available;
        }

        @Override
        public ItemCatalogData.FilterValues loadFilterValues() {
            return new ItemCatalogData.FilterValues(List.of("Weapon"), List.of("Simple"), List.of());
        }

        @Override
        public ItemCatalogData.CatalogPage search(ItemCatalogData.SearchSpec spec) {
            searchCalls++;
            return new ItemCatalogData.CatalogPage(List.of(), 0, spec.pageSize(), spec.pageOffset());
        }

        @Override
        public ItemCatalogData.Detail loadDetail(String sourceKey) {
            return null;
        }
    }

    private static final class RecordingStore implements ItemImportStore {
        private final List<String> events = new ArrayList<>();

        @Override
        public void initialize() {
            events.add("initialize");
        }

        @Override
        public BackupReceipt createVerifiedBackup() {
            events.add("backup");
            return new BackupReceipt(Instant.parse("2026-07-16T12:00:00Z"));
        }

        @Override
        public void replaceAll(ItemImportBatch batch) {
            events.add("replace:" + batch.items().size());
        }
    }

    private static final class QueuedLane implements ExecutionLane {
        private final List<Runnable> work = new ArrayList<>();

        @Override
        public void execute(Runnable task) {
            work.add(task);
        }

        void runNext() {
            work.removeFirst().run();
        }

        @Override
        public void close() {
        }
    }
}
