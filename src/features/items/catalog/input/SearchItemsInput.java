package features.items.catalog.input;

import java.util.List;

@SuppressWarnings("unused")
public record SearchItemsInput(
        CriteriaInput criteria,
        List<Long> excludeIds,
        PageInput page
) {

    public record CriteriaInput(
            String nameQuery,
            Integer minCostCp,
            Integer maxCostCp,
            boolean magicOnly,
            boolean attunementOnly,
            List<String> categories,
            List<String> subcategories,
            List<String> rarities,
            List<String> tags,
            List<String> sources
    ) {
    }

    public record PageInput(String sortColumn, String sortDirection, int limit, int offset) {
    }

    public record ItemSummaryInput(
            long itemId,
            String name,
            String category,
            String subcategory,
            boolean magic,
            String rarity,
            boolean requiresAttunement,
            int costCp,
            String costDisplay
    ) {
    }

    public record SearchedItemsInput(boolean success, List<ItemSummaryInput> items, int totalCount) {
    }
}
