package features.catalog.application;

import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;

public record ItemsCatalogState(
        CatalogResultState<ItemsCatalogApi.ItemRow> results,
        ItemsCatalogApi.FilterOptionsResult filterOptions,
        ItemsCatalogApi.ItemQuery query,
        String selectedSourceKey,
        String unfinishedInput
) {
    public ItemsCatalogState {
        results = Objects.requireNonNull(results, "results");
        filterOptions = Objects.requireNonNull(filterOptions, "filterOptions");
        query = Objects.requireNonNull(query, "query");
        selectedSourceKey = Objects.requireNonNull(selectedSourceKey, "selectedSourceKey");
        unfinishedInput = Objects.requireNonNull(unfinishedInput, "unfinishedInput");
    }

    static ItemsCatalogState initial() {
        return new ItemsCatalogState(
                CatalogResultState.loading(),
                new ItemsCatalogApi.FilterOptionsResult(
                        ItemsCatalogApi.CatalogStatus.UNAVAILABLE, List.of(), List.of(), List.of()),
                ItemsCatalogApi.ItemQuery.firstPage(), "", "");
    }
}
