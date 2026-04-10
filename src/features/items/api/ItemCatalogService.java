package features.items.api;

import features.items.catalog.CatalogObject;
import features.items.catalog.input.LoadFilterOptionsInput;
import features.items.catalog.input.LoadItemInput;
import features.items.catalog.input.SearchItemsByNameInput;
import features.items.catalog.input.SearchItemsInput;

import java.util.List;

/**
 * Compatibility facade for older item catalog callers.
 */
@SuppressWarnings("unused")
public final class ItemCatalogService {
    private static final CatalogObject CATALOG_OBJECT = new CatalogObject();

    private ItemCatalogService() {
        throw new AssertionError("No instances");
    }

    public record FilterOptions(
            List<String> categories,
            List<String> subcategories,
            List<String> rarities,
            List<String> tags,
            List<String> sources) {}

    public record FilterCriteria(
            String nameQuery,
            Integer minCostCp,
            Integer maxCostCp,
            boolean magicOnly,
            boolean attunementOnly,
            List<String> categories,
            List<String> subcategories,
            List<String> rarities,
            List<String> tags,
            List<String> sources) {

        public static FilterCriteria empty() {
            return new FilterCriteria(null, null, null, false, false,
                    List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    public record PageRequest(String sortColumn, String sortDirection, int limit, int offset) {}

    public record ItemSummary(
            long itemId,
            String name,
            String category,
            String subcategory,
            boolean magic,
            String rarity,
            boolean requiresAttunement,
            int costCp,
            String costDisplay
    ) {}

    public record ItemDetails(
            long itemId,
            String name,
            String category,
            String subcategory,
            boolean magic,
            String rarity,
            boolean requiresAttunement,
            String attunementCondition,
            String costDisplay,
            int costCp,
            double weightLb,
            String damage,
            String properties,
            String armorClass,
            String description,
            String source,
            List<String> tags
    ) {}

    public record PageResult(List<ItemSummary> items, int totalCount) {}

    public enum Status {
        OK,
        DB_ACCESS_FAILED
    }

    public record ServiceResult<T>(Status status, T value) {
        public boolean isOk() {
            return status == Status.OK;
        }

        public static <T> ServiceResult<T> ok(T value) {
            return new ServiceResult<>(Status.OK, value);
        }

        public static <T> ServiceResult<T> dbAccessFailed(T fallbackValue) {
            return new ServiceResult<>(Status.DB_ACCESS_FAILED, fallbackValue);
        }
    }

    public static ServiceResult<FilterOptions> loadFilterOptions() {
        LoadFilterOptionsInput.LoadedFilterOptionsInput loaded =
                CATALOG_OBJECT.loadFilterOptions(new LoadFilterOptionsInput());
        FilterOptions filterOptions = new FilterOptions(
                loaded.categories(),
                loaded.subcategories(),
                loaded.rarities(),
                loaded.tags(),
                loaded.sources());
        return loaded.success() ? ServiceResult.ok(filterOptions) : ServiceResult.dbAccessFailed(filterOptions);
    }

    public static ServiceResult<PageResult> searchItems(
            FilterCriteria criteria,
            List<Long> excludeIds,
            PageRequest pageRequest) {
        SearchItemsInput.SearchedItemsInput searched = CATALOG_OBJECT.searchItems(
                new SearchItemsInput(
                        criteria != null
                                ? new SearchItemsInput.CriteriaInput(
                                        criteria.nameQuery(),
                                        criteria.minCostCp(),
                                        criteria.maxCostCp(),
                                        criteria.magicOnly(),
                                        criteria.attunementOnly(),
                                        criteria.categories(),
                                        criteria.subcategories(),
                                        criteria.rarities(),
                                        criteria.tags(),
                                        criteria.sources())
                                : null,
                        excludeIds,
                        pageRequest != null
                                ? new SearchItemsInput.PageInput(
                                        pageRequest.sortColumn(),
                                        pageRequest.sortDirection(),
                                        pageRequest.limit(),
                                        pageRequest.offset())
                                : null));
        PageResult pageResult = new PageResult(
                searched.items().stream().map(ItemCatalogService::toItemSummary).toList(),
                searched.totalCount());
        return searched.success() ? ServiceResult.ok(pageResult) : ServiceResult.dbAccessFailed(pageResult);
    }

    public static ServiceResult<List<ItemSummary>> searchByName(String query, int limit) {
        SearchItemsByNameInput.SearchedItemsByNameInput searched =
                CATALOG_OBJECT.searchItemsByName(new SearchItemsByNameInput(query, limit));
        List<ItemSummary> items = searched.items().stream().map(ItemCatalogService::toItemSummary).toList();
        return searched.success() ? ServiceResult.ok(items) : ServiceResult.dbAccessFailed(items);
    }

    public static ServiceResult<ItemDetails> getItem(Long itemId) {
        LoadItemInput.LoadedItemInput loaded = CATALOG_OBJECT.loadItem(new LoadItemInput(itemId));
        ItemDetails item = loaded.item() != null ? toItemDetails(loaded.item()) : null;
        return loaded.success() ? ServiceResult.ok(item) : ServiceResult.dbAccessFailed(item);
    }

    private static ItemSummary toItemSummary(SearchItemsInput.ItemSummaryInput item) {
        return new ItemSummary(
                item.itemId(),
                item.name(),
                item.category(),
                item.subcategory(),
                item.magic(),
                item.rarity(),
                item.requiresAttunement(),
                item.costCp(),
                item.costDisplay());
    }

    private static ItemDetails toItemDetails(LoadItemInput.ItemDetailsInput item) {
        return new ItemDetails(
                item.itemId(),
                item.name(),
                item.category(),
                item.subcategory(),
                item.magic(),
                item.rarity(),
                item.requiresAttunement(),
                item.attunementCondition(),
                item.costDisplay(),
                item.costCp(),
                item.weightLb(),
                item.damage(),
                item.properties(),
                item.armorClass(),
                item.description(),
                item.source(),
                item.tags());
    }
}
