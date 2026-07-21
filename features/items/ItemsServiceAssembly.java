package features.items;

import features.items.adapter.sqlite.SqliteItemCatalogAdapter;
import features.items.api.ItemsCatalogApi;
import features.items.application.ItemsApplicationService;
import features.items.domain.catalog.ItemCatalogPort;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;

public final class ItemsServiceAssembly {

    private ItemsServiceAssembly() {
    }

    public static FeatureStoreDefinition storeDefinition() {
        return SqliteItemCatalogAdapter.storeDefinition();
    }

    public static CatalogComponent createCatalog(
            FeatureStoreHandle store,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        return createCatalog(new SqliteItemCatalogAdapter(store), executionLane, diagnostics);
    }

    public static CatalogComponent createCatalog(
            ItemCatalogPort catalog,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        ItemsApplicationService service =
                new ItemsApplicationService(catalog, executionLane, diagnostics);
        return new CatalogComponent(service);
    }

    public record CatalogComponent(ItemsCatalogApi catalog) {
        public void openInspector(shell.api.InspectorSink inspector, ItemsCatalogApi.ItemDetail detail) {
            features.items.adapter.javafx.ItemDetailsView.openInspector(inspector, detail);
        }
    }
}
