package features.catalog.application;

import features.items.api.ItemsCatalogApi;
import java.util.Objects;

/** Raw, unfinished Items filter input retained for the Catalog workspace lifetime. */
public record ItemsCatalogFilterDraft(
        String name,
        String category,
        String subcategory,
        String rarity,
        Boolean magic,
        Boolean attunement,
        String minimumCostCp,
        String maximumCostCp,
        ItemsCatalogApi.SortField sortField,
        boolean ascending
) {
    public ItemsCatalogFilterDraft {
        name = safe(name);
        category = safe(category);
        subcategory = safe(subcategory);
        rarity = safe(rarity);
        minimumCostCp = safe(minimumCostCp);
        maximumCostCp = safe(maximumCostCp);
        sortField = Objects.requireNonNullElse(sortField, ItemsCatalogApi.SortField.NAME);
    }

    public static ItemsCatalogFilterDraft empty() {
        return new ItemsCatalogFilterDraft("", "", "", "", null, null, "", "",
                ItemsCatalogApi.SortField.NAME, true);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
