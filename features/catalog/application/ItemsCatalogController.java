package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.ItemInspectorRoute;
import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import platform.ui.UiDispatcher;

/** Owns every Items state transition, provider request, and Inspector intent. */
public final class ItemsCatalogController implements CatalogLifecycle {

    private final ItemsCatalogApi provider;
    private final ItemInspectorRoute inspector;
    private final UiDispatcher dispatcher;
    private final Runnable changed;
    private ItemsCatalogState state = ItemsCatalogState.initial();

    ItemsCatalogController(
            ItemsCatalogApi provider,
            ItemInspectorRoute inspector,
            UiDispatcher dispatcher,
            Runnable changed
    ) {
        this.provider = Objects.requireNonNull(provider, "provider");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public ItemsCatalogState state() {
        return state;
    }

    public void accept(ItemsCatalogIntent intent) {
        if (intent == null || state.lifecycle() == ItemsCatalogState.Lifecycle.CLOSED) {
            return;
        }
        switch (intent) {
            case ItemsCatalogIntent.ChangeDraft change -> changeDraft(change.draft());
            case ItemsCatalogIntent.Search ignored -> searchFirstPage();
            case ItemsCatalogIntent.ClearFilters ignored -> clearFilters();
            case ItemsCatalogIntent.ShiftPage shift -> shiftPage(shift.direction());
            case ItemsCatalogIntent.SelectItem select -> select(select.sourceKey());
            case ItemsCatalogIntent.OpenItem open -> open(open.sourceKey());
        }
    }

    private void clearFilters() {
        changeDraft(ItemsCatalogFilterDraft.empty());
        searchFirstPage();
    }

    @Override
    public void activate() {
        if (state.lifecycle() != ItemsCatalogState.Lifecycle.INACTIVE) {
            return;
        }
        replace(state.lifecycleRevision() + 1L, state.optionsRequestRevision(), state.pageRequestRevision(),
                state.detailRequestRevision(), ItemsCatalogState.Lifecycle.ACTIVE, state.filterDraft(),
                state.filterOptions(), state.query(), state.results(), state.selectedSourceKey(),
                state.pageOffset(), state.totalCount(), state.actionMessage());
        try {
            loadFilterOptions();
            beginSearch(state.pageOffset());
        } catch (RuntimeException | Error failure) {
            rollbackActivation();
            throw failure;
        }
    }

    private void rollbackActivation() {
        replace(state.lifecycleRevision() + 1L, state.optionsRequestRevision() + 1L,
                state.pageRequestRevision() + 1L, state.detailRequestRevision() + 1L,
                ItemsCatalogState.Lifecycle.INACTIVE, state.filterDraft(), state.filterOptions(), state.query(),
                state.results(), state.selectedSourceKey(), state.pageOffset(), state.totalCount(),
                state.actionMessage());
    }

    @Override
    public void deactivate() {
        if (state.lifecycle() != ItemsCatalogState.Lifecycle.ACTIVE) {
            return;
        }
        replace(state.lifecycleRevision() + 1L, state.optionsRequestRevision() + 1L,
                state.pageRequestRevision() + 1L, state.detailRequestRevision() + 1L,
                ItemsCatalogState.Lifecycle.INACTIVE, state.filterDraft(), state.filterOptions(), state.query(),
                state.results(), state.selectedSourceKey(), state.pageOffset(), state.totalCount(),
                state.actionMessage());
    }

    @Override
    public void close() {
        if (state.lifecycle() == ItemsCatalogState.Lifecycle.CLOSED) {
            return;
        }
        deactivate();
        replace(state.lifecycleRevision() + 1L, state.optionsRequestRevision() + 1L,
                state.pageRequestRevision() + 1L, state.detailRequestRevision() + 1L,
                ItemsCatalogState.Lifecycle.CLOSED, state.filterDraft(), state.filterOptions(), state.query(),
                state.results(), state.selectedSourceKey(), state.pageOffset(), state.totalCount(),
                state.actionMessage());
    }

    private void changeDraft(ItemsCatalogFilterDraft draft) {
        if (draft.equals(state.filterDraft())) {
            return;
        }
        replaceKeepingLifecycle(draft, state.filterOptions(), state.query(), state.results(),
                state.selectedSourceKey(), state.pageOffset(), state.totalCount(), state.actionMessage());
    }

    private void searchFirstPage() {
        beginSearch(0);
    }

    private void shiftPage(int direction) {
        int nextOffset = state.pageOffset();
        if (direction < 0) {
            nextOffset = Math.max(0, nextOffset - state.pageSize());
        } else if (direction > 0 && nextOffset + state.pageSize() < state.totalCount()) {
            nextOffset += state.pageSize();
        }
        if (nextOffset != state.pageOffset()) {
            beginSearch(nextOffset);
        }
    }

    private void select(String sourceKey) {
        String selected = sourceKey == null ? "" : sourceKey;
        if (selected.equals(state.selectedSourceKey())) {
            return;
        }
        replaceKeepingLifecycle(state.filterDraft(), state.filterOptions(), state.query(), state.results(),
                selected, state.pageOffset(), state.totalCount(), state.actionMessage());
    }

    private void beginSearch(int pageOffset) {
        if (state.lifecycle() != ItemsCatalogState.Lifecycle.ACTIVE) {
            return;
        }
        ItemsCatalogApi.ItemQuery query;
        try {
            query = query(state.filterDraft(), pageOffset);
        } catch (IllegalArgumentException exception) {
            replace(state.lifecycleRevision(), state.optionsRequestRevision(), state.pageRequestRevision() + 1L,
                    state.detailRequestRevision() + 1L, state.lifecycle(), state.filterDraft(),
                    state.filterOptions(), state.query(),
                    new CatalogResultState<>(CatalogResultState.Status.INVALID_INPUT, List.of(),
                            "Ungültige Item-Suche."),
                    state.selectedSourceKey(), 0, 0, "");
            return;
        }
        long lifecycleRevision = state.lifecycleRevision();
        long requestRevision = state.pageRequestRevision() + 1L;
        replace(lifecycleRevision, state.optionsRequestRevision(), requestRevision,
                state.detailRequestRevision() + 1L,
                state.lifecycle(), state.filterDraft(), state.filterOptions(), query, CatalogResultState.loading(),
                state.selectedSourceKey(), pageOffset, state.totalCount(), "");
        provider.search(query).whenComplete((result, failure) -> dispatcher.dispatch(() ->
                completeSearch(lifecycleRevision, requestRevision, result, failure)));
    }

    private void completeSearch(
            long lifecycleRevision,
            long requestRevision,
            ItemsCatalogApi.PageResult result,
            Throwable failure
    ) {
        if (!acceptsPage(lifecycleRevision, requestRevision)) {
            return;
        }
        CatalogResultState<ItemsCatalogApi.ItemRow> results = pageResult(result, failure);
        int pageOffset = result != null && result.status() == ItemsCatalogApi.CatalogStatus.SUCCESS
                ? Math.max(0, result.pageOffset()) : 0;
        int totalCount = result != null && result.status() == ItemsCatalogApi.CatalogStatus.SUCCESS
                ? Math.max(0, result.totalCount()) : 0;
        String selected = results.rows().stream()
                .anyMatch(row -> row.sourceKey().equals(state.selectedSourceKey()))
                ? state.selectedSourceKey() : "";
        replaceKeepingLifecycle(state.filterDraft(), state.filterOptions(), state.query(), results,
                selected, pageOffset, totalCount, "");
    }

    private void loadFilterOptions() {
        if (state.lifecycle() != ItemsCatalogState.Lifecycle.ACTIVE) {
            return;
        }
        long lifecycleRevision = state.lifecycleRevision();
        long requestRevision = state.optionsRequestRevision() + 1L;
        replace(lifecycleRevision, requestRevision, state.pageRequestRevision(), state.detailRequestRevision(),
                state.lifecycle(), state.filterDraft(), state.filterOptions(), state.query(), state.results(),
                state.selectedSourceKey(), state.pageOffset(), state.totalCount(), state.actionMessage());
        provider.loadFilterOptions().whenComplete((result, failure) -> dispatcher.dispatch(() -> {
            if (!acceptsOptions(lifecycleRevision, requestRevision)) {
                return;
            }
            ItemsCatalogApi.FilterOptionsResult safe = failure == null && result != null
                    ? result
                    : new ItemsCatalogApi.FilterOptionsResult(
                            ItemsCatalogApi.CatalogStatus.EXECUTION_ERROR, List.of(), List.of(), List.of());
            replaceKeepingLifecycle(state.filterDraft(), safe, state.query(), state.results(),
                    state.selectedSourceKey(), state.pageOffset(), state.totalCount(), state.actionMessage());
        }));
    }

    private void open(String sourceKey) {
        if (state.lifecycle() != ItemsCatalogState.Lifecycle.ACTIVE
                || sourceKey == null || sourceKey.isBlank()
                || !isVisible(sourceKey)) {
            return;
        }
        long lifecycleRevision = state.lifecycleRevision();
        long requestRevision = state.detailRequestRevision() + 1L;
        replace(lifecycleRevision, state.optionsRequestRevision(), state.pageRequestRevision(), requestRevision,
                state.lifecycle(), state.filterDraft(), state.filterOptions(), state.query(), state.results(),
                state.selectedSourceKey(), state.pageOffset(), state.totalCount(), "Item-Details werden geladen …");
        provider.loadDetail(sourceKey).whenComplete((result, failure) -> dispatcher.dispatch(() ->
                completeDetail(lifecycleRevision, requestRevision, sourceKey, result, failure)));
    }

    private void completeDetail(
            long lifecycleRevision,
            long requestRevision,
            String sourceKey,
            ItemsCatalogApi.DetailResult result,
            Throwable failure
    ) {
        if (!acceptsDetail(lifecycleRevision, requestRevision, sourceKey)) {
            return;
        }
        String message;
        if (failure != null || result == null) {
            message = "Item-Details konnten nicht geladen werden.";
        } else if (result.status() != ItemsCatalogApi.CatalogStatus.SUCCESS) {
            message = statusText(result.status());
        } else if (result.detail() == null) {
            message = "Item-Details nicht verfügbar.";
        } else {
            inspector.openItem(result.detail());
            message = "Item-Details geöffnet.";
        }
        replaceKeepingLifecycle(state.filterDraft(), state.filterOptions(), state.query(), state.results(),
                state.selectedSourceKey(), state.pageOffset(), state.totalCount(), message);
    }

    private boolean acceptsOptions(long lifecycleRevision, long requestRevision) {
        return state.lifecycle() == ItemsCatalogState.Lifecycle.ACTIVE
                && state.lifecycleRevision() == lifecycleRevision
                && state.optionsRequestRevision() == requestRevision;
    }

    private boolean acceptsPage(long lifecycleRevision, long requestRevision) {
        return state.lifecycle() == ItemsCatalogState.Lifecycle.ACTIVE
                && state.lifecycleRevision() == lifecycleRevision
                && state.pageRequestRevision() == requestRevision;
    }

    private boolean acceptsDetail(long lifecycleRevision, long requestRevision, String sourceKey) {
        return state.lifecycle() == ItemsCatalogState.Lifecycle.ACTIVE
                && state.lifecycleRevision() == lifecycleRevision
                && state.detailRequestRevision() == requestRevision
                && isVisible(sourceKey);
    }

    private boolean isVisible(String sourceKey) {
        return state.results().rows().stream()
                .anyMatch(row -> sourceKey.equals(row.sourceKey()));
    }

    private ItemsCatalogApi.ItemQuery query(ItemsCatalogFilterDraft draft, int pageOffset) {
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
                draft.sortField(), draft.ascending(), state.pageSize(), Math.max(0, pageOffset));
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

    private static CatalogResultState<ItemsCatalogApi.ItemRow> pageResult(
            ItemsCatalogApi.PageResult result,
            Throwable failure
    ) {
        if (failure != null || result == null) {
            return CatalogResultState.failed("Item-Suche konnte nicht ausgeführt werden.");
        }
        return switch (result.status()) {
            case SUCCESS -> CatalogResultState.ready(result.rows());
            case INVALID_QUERY -> new CatalogResultState<>(
                    CatalogResultState.Status.INVALID_INPUT, List.of(), "Ungültige Item-Suche.");
            case UNAVAILABLE -> new CatalogResultState<>(
                    CatalogResultState.Status.UNAVAILABLE, List.of(), "Noch kein Item-Katalog importiert.");
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
            case NOT_FOUND -> "Item nicht gefunden.";
            case STORAGE_ERROR -> "Item-Katalog konnte nicht gelesen werden.";
            case EXECUTION_ERROR -> "Item-Suche konnte nicht ausgeführt werden.";
        };
    }

    private void replaceKeepingLifecycle(
            ItemsCatalogFilterDraft draft,
            ItemsCatalogApi.FilterOptionsResult options,
            ItemsCatalogApi.ItemQuery query,
            CatalogResultState<ItemsCatalogApi.ItemRow> results,
            String selectedSourceKey,
            int pageOffset,
            int totalCount,
            String actionMessage
    ) {
        replace(state.lifecycleRevision(), state.optionsRequestRevision(), state.pageRequestRevision(),
                state.detailRequestRevision(), state.lifecycle(), draft, options, query, results,
                selectedSourceKey, pageOffset, totalCount, actionMessage);
    }

    private void replace(
            long lifecycleRevision,
            long optionsRequestRevision,
            long pageRequestRevision,
            long detailRequestRevision,
            ItemsCatalogState.Lifecycle lifecycle,
            ItemsCatalogFilterDraft draft,
            ItemsCatalogApi.FilterOptionsResult options,
            ItemsCatalogApi.ItemQuery query,
            CatalogResultState<ItemsCatalogApi.ItemRow> results,
            String selectedSourceKey,
            int pageOffset,
            int totalCount,
            String actionMessage
    ) {
        state = new ItemsCatalogState(
                state.revision() + 1L, lifecycleRevision, optionsRequestRevision, pageRequestRevision,
                detailRequestRevision, lifecycle, draft, options, query, results, selectedSourceKey,
                state.pageSize(), pageOffset, totalCount, actionMessage);
        changed.run();
    }
}
