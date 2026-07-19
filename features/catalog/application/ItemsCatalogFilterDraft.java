package features.catalog.application;

/** Raw, unfinished Items filter input retained for the Catalog workspace lifetime. */
public record ItemsCatalogFilterDraft(
        String name,
        String category,
        String subcategory,
        String rarity,
        Boolean magic,
        Boolean attunement,
        String minimumCostCp,
        String maximumCostCp
) {
    public ItemsCatalogFilterDraft {
        name = safe(name);
        category = safe(category);
        subcategory = safe(subcategory);
        rarity = safe(rarity);
        minimumCostCp = safe(minimumCostCp);
        maximumCostCp = safe(maximumCostCp);
    }

    public static ItemsCatalogFilterDraft empty() {
        return new ItemsCatalogFilterDraft("", "", "", "", null, null, "", "");
    }

    public ItemsCatalogFilterDraft withName(String value) {
        return copy(value, category, subcategory, rarity, magic, attunement,
                minimumCostCp, maximumCostCp);
    }

    public ItemsCatalogFilterDraft withCategory(String value) {
        return copy(name, value, subcategory, rarity, magic, attunement,
                minimumCostCp, maximumCostCp);
    }

    public ItemsCatalogFilterDraft withSubcategory(String value) {
        return copy(name, category, value, rarity, magic, attunement,
                minimumCostCp, maximumCostCp);
    }

    public ItemsCatalogFilterDraft withRarity(String value) {
        return copy(name, category, subcategory, value, magic, attunement,
                minimumCostCp, maximumCostCp);
    }

    public ItemsCatalogFilterDraft withMagic(Boolean value) {
        return copy(name, category, subcategory, rarity, value, attunement,
                minimumCostCp, maximumCostCp);
    }

    public ItemsCatalogFilterDraft withAttunement(Boolean value) {
        return copy(name, category, subcategory, rarity, magic, value,
                minimumCostCp, maximumCostCp);
    }

    public ItemsCatalogFilterDraft withCostRange(String minimum, String maximum) {
        return copy(name, category, subcategory, rarity, magic, attunement,
                minimum, maximum);
    }

    private static ItemsCatalogFilterDraft copy(
            String name,
            String category,
            String subcategory,
            String rarity,
            Boolean magic,
            Boolean attunement,
            String minimum,
            String maximum
    ) {
        return new ItemsCatalogFilterDraft(
                name, category, subcategory, rarity, magic, attunement, minimum, maximum);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
