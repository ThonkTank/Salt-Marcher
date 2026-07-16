package src.domain.items;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import src.domain.items.ItemsCatalogApi.ItemQuery;
import src.domain.items.ItemsCatalogApi.SortField;
import src.domain.items.ItemsCatalogApi.Status;
import src.domain.items.model.ItemCatalogData;
import src.domain.items.model.ItemCatalogPort;

class ItemsApplicationServiceTest {

    @Test
    void reportsUnavailableWithoutQueryingRows() {
        FakeCatalog catalog = new FakeCatalog(false);
        ItemsApplicationService service = new ItemsApplicationService(catalog);

        assertEquals(Status.UNAVAILABLE, service.search(ItemQuery.firstPage()).toCompletableFuture().join().status());
        assertEquals(0, catalog.searchCalls);
    }

    @Test
    void rejectsAnInvertedCostRangeBeforeStorage() {
        FakeCatalog catalog = new FakeCatalog(true);
        ItemsApplicationService service = new ItemsApplicationService(catalog);
        ItemQuery query = new ItemQuery(null, null, null, null, null, null,
                500, 100, SortField.COST, true, 50, 0);

        assertEquals(Status.INVALID_QUERY, service.search(query).toCompletableFuture().join().status());
        assertEquals(0, catalog.searchCalls);
    }

    @Test
    void projectsReadOnlyCatalogRowsAndDetails() {
        FakeCatalog catalog = new FakeCatalog(true);
        ItemsApplicationService service = new ItemsApplicationService(catalog);

        assertEquals("Club", service.search(ItemQuery.firstPage()).toCompletableFuture().join().rows().getFirst().name());
        assertEquals("2014 SRD",
                service.loadDetail("equipment:club").toCompletableFuture().join().detail().sourceVersion());
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
            return new ItemCatalogData.CatalogPage(List.of(row()), 1, spec.pageSize(), spec.pageOffset());
        }

        @Override
        public ItemCatalogData.Detail loadDetail(String sourceKey) {
            return new ItemCatalogData.Detail(row(), 2.0, "1d4 bludgeoning", "", List.of("Light"),
                    "A wooden club.", "2014 SRD", "https://www.dnd5eapi.co/api/2014/equipment/club");
        }

        private static ItemCatalogData.CatalogRow row() {
            return new ItemCatalogData.CatalogRow("equipment:club", "Club", "Weapon", "Simple", false,
                    "", false, 10, "1 sp");
        }
    }
}
