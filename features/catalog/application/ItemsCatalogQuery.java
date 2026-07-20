package features.catalog.application;

import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;

/** Typed Items draft plus provider-supplied choices. */
public record ItemsCatalogQuery(
        ItemsCatalogFilterDraft filters,
        ItemsCatalogApi.FilterOptionsResult options,
        boolean filterOptionsResolved
) {
    public ItemsCatalogQuery {
        filters = Objects.requireNonNull(filters, "filters");
        options = Objects.requireNonNull(options, "options");
    }

    public static ItemsCatalogQuery initial() {
        return new ItemsCatalogQuery(
                ItemsCatalogFilterDraft.empty(),
                new ItemsCatalogApi.FilterOptionsResult(
                        ItemsCatalogApi.CatalogStatus.UNAVAILABLE, List.of(), List.of(), List.of()),
                false);
    }

    public ItemsCatalogQuery withFilters(ItemsCatalogFilterDraft next) {
        return new ItemsCatalogQuery(next, options, filterOptionsResolved);
    }

    public ItemsCatalogQuery withOptions(ItemsCatalogApi.FilterOptionsResult next) {
        return new ItemsCatalogQuery(filters, next, true);
    }
}
