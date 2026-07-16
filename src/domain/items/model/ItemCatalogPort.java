package src.domain.items.model;

import org.jspecify.annotations.Nullable;
import src.domain.items.model.ItemCatalogData.Detail;

public interface ItemCatalogPort {

    boolean isAvailable();

    ItemCatalogData.FilterValues loadFilterValues();

    ItemCatalogData.CatalogPage search(ItemCatalogData.SearchSpec spec);

    @Nullable Detail loadDetail(String sourceKey);
}
