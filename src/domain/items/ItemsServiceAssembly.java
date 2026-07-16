package src.domain.items;

import java.util.concurrent.Executor;
import src.domain.items.model.ItemCatalogPort;

public final class ItemsServiceAssembly {

    private ItemsServiceAssembly() {
    }

    public static Component create(ItemCatalogPort catalog) {
        ItemsApplicationService application = new ItemsApplicationService(catalog);
        return new Component(application, application);
    }

    public static Component create(ItemCatalogPort catalog, Executor executor) {
        ItemsApplicationService application = new ItemsApplicationService(catalog, executor);
        return new Component(application, application);
    }

    public record Component(ItemsApplicationService application, ItemsCatalogApi catalog) {
    }
}
