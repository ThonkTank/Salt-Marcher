package features.items.domain.catalog;

import features.items.domain.catalog.ItemCatalogData.Detail;
import org.jspecify.annotations.Nullable;

public interface ItemCatalogPort {

    boolean isAvailable();

    ItemCatalogData.FilterValues loadFilterValues();

    ItemCatalogData.CatalogPage search(ItemCatalogData.SearchSpec spec);

    @Nullable Detail loadDetail(String sourceKey);
}
