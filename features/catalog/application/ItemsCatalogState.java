package features.catalog.application;

import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;

/** The single immutable Items truth rendered by the Catalog workspace. */
public record ItemsCatalogState(
        long revision,
        long lifecycleRevision,
        long optionsRequestRevision,
        long pageRequestRevision,
        long detailRequestRevision,
        Lifecycle lifecycle,
        ItemsCatalogFilterDraft filterDraft,
        ItemsCatalogApi.FilterOptionsResult filterOptions,
        ItemsCatalogApi.ItemQuery query,
        CatalogResultState<ItemsCatalogApi.ItemRow> results,
        String selectedSourceKey,
        int pageSize,
        int pageOffset,
        int totalCount,
        String actionMessage
) {
    public ItemsCatalogState {
        revision = Math.max(0L, revision);
        lifecycleRevision = Math.max(0L, lifecycleRevision);
        optionsRequestRevision = Math.max(0L, optionsRequestRevision);
        pageRequestRevision = Math.max(0L, pageRequestRevision);
        detailRequestRevision = Math.max(0L, detailRequestRevision);
        lifecycle = Objects.requireNonNull(lifecycle, "lifecycle");
        filterDraft = Objects.requireNonNull(filterDraft, "filterDraft");
        filterOptions = Objects.requireNonNull(filterOptions, "filterOptions");
        query = Objects.requireNonNull(query, "query");
        results = Objects.requireNonNull(results, "results");
        selectedSourceKey = selectedSourceKey == null ? "" : selectedSourceKey;
        pageSize = Math.max(1, pageSize);
        pageOffset = Math.max(0, pageOffset);
        totalCount = Math.max(0, totalCount);
        actionMessage = actionMessage == null ? "" : actionMessage;
    }

    static ItemsCatalogState initial() {
        return new ItemsCatalogState(
                0L, 0L, 0L, 0L, 0L, Lifecycle.INACTIVE,
                ItemsCatalogFilterDraft.empty(),
                new ItemsCatalogApi.FilterOptionsResult(
                        ItemsCatalogApi.CatalogStatus.UNAVAILABLE, List.of(), List.of(), List.of()),
                ItemsCatalogApi.ItemQuery.firstPage(), CatalogResultState.loading(), "", 50, 0, 0, "");
    }

    public enum Lifecycle {
        INACTIVE,
        ACTIVE,
        CLOSED
    }
}
