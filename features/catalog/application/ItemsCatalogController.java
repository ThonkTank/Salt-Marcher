package features.catalog.application;

import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;

public final class ItemsCatalogController implements CatalogLifecycle {

    private final ItemsCatalogApi provider;
    private final Runnable changed;
    private ItemsCatalogState state = ItemsCatalogState.initial();
    private boolean active;

    ItemsCatalogController(ItemsCatalogApi provider, Runnable changed) {
        this.provider = Objects.requireNonNull(provider, "provider");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public ItemsCatalogState state() {
        return state;
    }

    ItemsCatalogApi provider() {
        return provider;
    }

    void applyFilterOptions(ItemsCatalogApi.FilterOptionsResult result, Throwable failure) {
        ItemsCatalogApi.FilterOptionsResult safe = failure == null && result != null
                ? result
                : new ItemsCatalogApi.FilterOptionsResult(
                        ItemsCatalogApi.CatalogStatus.EXECUTION_ERROR, List.of(), List.of(), List.of());
        state = new ItemsCatalogState(
                state.results(), safe, state.query(), state.selectedSourceKey(), state.unfinishedInput());
        changed.run();
    }

    void beginSearch(ItemsCatalogApi.ItemQuery query) {
        state = new ItemsCatalogState(
                CatalogResultState.loading(), state.filterOptions(), Objects.requireNonNull(query, "query"),
                state.selectedSourceKey(), query.name() == null ? "" : query.name());
        changed.run();
    }

    void applyInvalidQuery() {
        state = new ItemsCatalogState(
                new CatalogResultState<>(
                        CatalogResultState.Status.INVALID_INPUT, List.of(), "Ungültige Item-Suche."),
                state.filterOptions(), state.query(), state.selectedSourceKey(), state.unfinishedInput());
        changed.run();
    }

    void applyPage(ItemsCatalogApi.PageResult result, Throwable failure) {
        ItemsCatalogApi.PageResult safe = failure == null ? result : null;
        CatalogResultState<ItemsCatalogApi.ItemRow> results;
        if (safe == null) {
            results = CatalogResultState.failed("Item-Suche konnte nicht ausgeführt werden.");
        } else {
            results = switch (safe.status()) {
                case SUCCESS -> CatalogResultState.ready(safe.rows());
                case INVALID_QUERY -> new CatalogResultState<>(
                        CatalogResultState.Status.INVALID_INPUT, List.of(), "Ungültige Item-Suche.");
                case UNAVAILABLE -> new CatalogResultState<>(
                        CatalogResultState.Status.UNAVAILABLE, List.of(), "Noch kein Item-Katalog importiert.");
                default -> CatalogResultState.failed("Item-Katalog konnte nicht gelesen werden.");
            };
        }
        state = new ItemsCatalogState(
                results, state.filterOptions(), state.query(), state.selectedSourceKey(), state.unfinishedInput());
        changed.run();
    }

    @Override
    public void activate() {
        if (active) {
            return;
        }
        active = true;
    }

    @Override
    public void deactivate() {
        if (!active) {
            return;
        }
        active = false;
    }

    @Override
    public void close() {
        deactivate();
    }
}
