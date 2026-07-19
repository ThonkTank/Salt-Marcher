package features.catalog.application;

import features.items.api.ItemsCatalogApi;
import java.util.Objects;
import java.util.List;

/** Temporary M3 presentation projection; browse truth lives in CatalogSectionState. */
public record ItemsCatalogState(
        long revision,
        ItemsCatalogFilterDraft filterDraft,
        ItemsCatalogApi.FilterOptionsResult filterOptions,
        CatalogResultState<ItemsCatalogApi.ItemRow> results,
        String selectedSourceKey,
        int pageSize,
        int pageOffset,
        int totalCount,
        String actionMessage
) {
    public ItemsCatalogState {
        revision = Math.max(0L, revision);
        filterDraft = Objects.requireNonNull(filterDraft, "filterDraft");
        filterOptions = Objects.requireNonNull(filterOptions, "filterOptions");
        results = Objects.requireNonNull(results, "results");
        selectedSourceKey = Objects.requireNonNullElse(selectedSourceKey, "");
        pageSize = Math.max(1, pageSize);
        pageOffset = Math.max(0, pageOffset);
        totalCount = Math.max(0, totalCount);
        actionMessage = Objects.requireNonNullElse(actionMessage, "");
    }

    static ItemsCatalogState initial() {
        return new ItemsCatalogState(
                0L, ItemsCatalogFilterDraft.empty(),
                new ItemsCatalogApi.FilterOptionsResult(
                        ItemsCatalogApi.CatalogStatus.UNAVAILABLE, List.of(), List.of(), List.of()),
                CatalogResultState.uninitialized(), "", 50, 0, 0, "");
    }
}
