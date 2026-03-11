package features.items.api;

import features.items.service.ItemCatalogApplicationService;

import java.util.List;

public final class ItemCatalogService {

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
        return ItemCatalogApplicationService.loadFilterOptions();
    }

    public static ServiceResult<PageResult> searchItems(
            FilterCriteria criteria,
            List<Long> excludeIds,
            PageRequest pageRequest) {
        return ItemCatalogApplicationService.searchItems(criteria, excludeIds, pageRequest);
    }

    public static ServiceResult<List<ItemSummary>> searchByName(String query, int limit) {
        return ItemCatalogApplicationService.searchByName(query, limit);
    }

    public static ServiceResult<ItemDetails> getItem(Long itemId) {
        return ItemCatalogApplicationService.getItem(itemId);
    }
}
