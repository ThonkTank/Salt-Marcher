package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.ItemInspectorRoute;
import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

/** Items provider translation and detail action; browse lifecycle remains in BrowseSession. */
public final class ItemsCatalogDefinition
        implements CatalogSectionDefinition<ItemsCatalogQuery, ItemsCatalogApi.ItemRow, String> {

    private final ItemsCatalogApi provider;
    private final ItemInspectorRoute inspector;
    private final AtomicLong providerRevision = new AtomicLong();

    public ItemsCatalogDefinition(ItemsCatalogApi provider, ItemInspectorRoute inspector) {
        this.provider = Objects.requireNonNull(provider, "provider");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
    }

    @Override public CatalogSectionId id() {
        return CatalogSectionId.ITEMS;
    }

    @Override public ItemsCatalogQuery initialQuery() {
        return ItemsCatalogQuery.initial();
    }

    @Override
    public CompletionStage<CatalogBrowseResult<ItemsCatalogQuery, ItemsCatalogApi.ItemRow>> query(
            CatalogBrowseRequest<ItemsCatalogQuery> request
    ) {
        ItemsCatalogQuery query = request.query();
        ItemsCatalogApi.ItemQuery providerQuery;
        try {
            providerQuery = providerQuery(query.filters(), request.pageSize(), request.pageOffset());
        } catch (IllegalArgumentException invalid) {
            return java.util.concurrent.CompletableFuture.completedFuture(new CatalogBrowseResult<>(
                    query,
                    new CatalogResultState<>(CatalogResultState.Status.INVALID_INPUT, List.of(),
                            "Ungültige Item-Suche."),
                    0, 0, providerRevision.incrementAndGet()));
        }
        CompletionStage<ItemsCatalogApi.FilterOptionsResult> options = provider.loadFilterOptions()
                .handle((result, failure) -> failure == null && result != null ? result
                        : new ItemsCatalogApi.FilterOptionsResult(
                                ItemsCatalogApi.CatalogStatus.EXECUTION_ERROR,
                                List.of(), List.of(), List.of()));
        return options.thenCombine(provider.search(providerQuery), (acceptedOptions, page) -> {
            CatalogResultState<ItemsCatalogApi.ItemRow> result = pageResult(page);
            int offset = page != null && page.status() == ItemsCatalogApi.CatalogStatus.SUCCESS
                    ? page.pageOffset() : 0;
            int total = page != null && page.status() == ItemsCatalogApi.CatalogStatus.SUCCESS
                    ? page.totalCount() : 0;
            return new CatalogBrowseResult<>(query.withOptions(acceptedOptions), result, offset, total,
                    providerRevision.incrementAndGet());
        });
    }

    @Override public String key(ItemsCatalogApi.ItemRow row) {
        return row.sourceKey();
    }

    public CompletionStage<String> open(String sourceKey) {
        if (sourceKey == null || sourceKey.isBlank()) {
            return java.util.concurrent.CompletableFuture.completedFuture("");
        }
        return provider.loadDetail(sourceKey).handle((result, failure) -> {
            if (failure != null || result == null) {
                return "Item-Details konnten nicht geladen werden.";
            }
            if (result.status() != ItemsCatalogApi.CatalogStatus.SUCCESS) {
                return statusText(result.status());
            }
            if (result.detail() == null) {
                return "Item-Details nicht verfügbar.";
            }
            inspector.openItem(result.detail());
            return "Item-Details geöffnet.";
        });
    }

    private static ItemsCatalogApi.ItemQuery providerQuery(
            ItemsCatalogFilterDraft draft,
            int pageSize,
            int pageOffset
    ) {
        Integer minimum = cost(draft.minimumCostCp());
        Integer maximum = cost(draft.maximumCostCp());
        if ((minimum != null && minimum < 0)
                || (maximum != null && maximum < 0)
                || (minimum != null && maximum != null && minimum > maximum)) {
            throw new IllegalArgumentException("Invalid cost range");
        }
        return new ItemsCatalogApi.ItemQuery(
                trimmed(draft.name()), nullable(draft.category()), nullable(draft.subcategory()),
                nullable(draft.rarity()), draft.magic(), draft.attunement(), minimum, maximum,
                draft.sortField(), draft.ascending(), pageSize, Math.max(0, pageOffset));
    }

    private static @Nullable Integer cost(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Invalid cost", exception);
        }
    }

    private static @Nullable String trimmed(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static @Nullable String nullable(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static CatalogResultState<ItemsCatalogApi.ItemRow> pageResult(ItemsCatalogApi.PageResult result) {
        if (result == null) {
            return CatalogResultState.failed("Item-Suche konnte nicht ausgeführt werden.");
        }
        return switch (result.status()) {
            case SUCCESS -> CatalogResultState.ready(result.rows());
            case INVALID_QUERY -> new CatalogResultState<>(
                    CatalogResultState.Status.INVALID_INPUT, List.of(), "Ungültige Item-Suche.");
            case UNAVAILABLE -> new CatalogResultState<>(
                    CatalogResultState.Status.UNAVAILABLE, List.of(), "Noch kein Item-Katalog importiert.");
            case INCOMPATIBLE -> CatalogResultState.failed("Item-Katalog ist nicht kompatibel.");
            case NOT_FOUND -> CatalogResultState.ready(List.of());
            case STORAGE_ERROR -> CatalogResultState.failed("Item-Katalog konnte nicht gelesen werden.");
            case EXECUTION_ERROR -> CatalogResultState.failed("Item-Suche konnte nicht ausgeführt werden.");
        };
    }

    private static String statusText(ItemsCatalogApi.CatalogStatus status) {
        return switch (status) {
            case SUCCESS -> "";
            case INVALID_QUERY -> "Ungültige Item-Suche.";
            case UNAVAILABLE -> "Noch kein Item-Katalog importiert.";
            case INCOMPATIBLE -> "Item-Katalog ist nicht kompatibel.";
            case NOT_FOUND -> "Item nicht gefunden.";
            case STORAGE_ERROR -> "Item-Katalog konnte nicht gelesen werden.";
            case EXECUTION_ERROR -> "Item-Suche konnte nicht ausgeführt werden.";
        };
    }
}
