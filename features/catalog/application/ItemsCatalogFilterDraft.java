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

    public ItemsCatalogFilterDraft withName(String value) {
        return copy(value, category, subcategory, rarity, magic, attunement,
                minimumCostCp, maximumCostCp, sortField, ascending);
    }

    public ItemsCatalogFilterDraft withCategory(String value) {
        return copy(name, value, subcategory, rarity, magic, attunement,
                minimumCostCp, maximumCostCp, sortField, ascending);
    }

    public ItemsCatalogFilterDraft withSubcategory(String value) {
        return copy(name, category, value, rarity, magic, attunement,
                minimumCostCp, maximumCostCp, sortField, ascending);
    }

    public ItemsCatalogFilterDraft withRarity(String value) {
        return copy(name, category, subcategory, value, magic, attunement,
                minimumCostCp, maximumCostCp, sortField, ascending);
    }

    public ItemsCatalogFilterDraft withMagic(Boolean value) {
        return copy(name, category, subcategory, rarity, value, attunement,
                minimumCostCp, maximumCostCp, sortField, ascending);
    }

    public ItemsCatalogFilterDraft withAttunement(Boolean value) {
        return copy(name, category, subcategory, rarity, magic, value,
                minimumCostCp, maximumCostCp, sortField, ascending);
    }

    public ItemsCatalogFilterDraft withCostRange(String minimum, String maximum) {
        return copy(name, category, subcategory, rarity, magic, attunement,
                minimum, maximum, sortField, ascending);
    }

    public ItemsCatalogFilterDraft withSortField(ItemsCatalogApi.SortField value) {
        return copy(name, category, subcategory, rarity, magic, attunement,
                minimumCostCp, maximumCostCp, value, ascending);
    }

    public ItemsCatalogFilterDraft withAscending(boolean value) {
        return copy(name, category, subcategory, rarity, magic, attunement,
                minimumCostCp, maximumCostCp, sortField, value);
    }

    private static ItemsCatalogFilterDraft copy(
            String name,
            String category,
            String subcategory,
            String rarity,
            Boolean magic,
            Boolean attunement,
            String minimum,
            String maximum,
            ItemsCatalogApi.SortField sort,
            boolean ascending
    ) {
        return new ItemsCatalogFilterDraft(
                name, category, subcategory, rarity, magic, attunement, minimum, maximum, sort, ascending);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
