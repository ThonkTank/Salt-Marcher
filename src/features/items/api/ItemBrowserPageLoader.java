package features.items.api;

@FunctionalInterface
public interface ItemBrowserPageLoader {
    /**
     * Loads one browser page.
     * Implementations must never return {@code null}.
     * The returned {@link features.items.api.ItemCatalogService.PageResult} and its {@code items()} list
     * must also be non-null.
     */
    ItemCatalogService.ServiceResult<ItemCatalogService.PageResult> load(
            ItemCatalogService.FilterCriteria criteria,
            ItemCatalogService.PageRequest pageRequest);
}
