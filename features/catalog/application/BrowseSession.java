package features.catalog.application;

import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import platform.ui.UiDispatcher;

/** The sole lifecycle, debounce, request-ordering, paging, and selection runtime for Catalog. */
public final class BrowseSession<Q, R, K> implements CatalogLifecycle {

    public static final Duration DEFAULT_DEBOUNCE = Duration.ofMillis(200L);

    private final CatalogSectionDefinition<Q, R, K> definition;
    private final UiDispatcher dispatcher;
    private final ScheduledExecutorService scheduler;
    private final long debounceMillis;
    private final Runnable changed;
    private CatalogSectionState<Q, R, K> state;
    private Runnable unsubscribe;
    private ScheduledFuture<?> pendingCommit;

    public BrowseSession(
            CatalogSectionDefinition<Q, R, K> definition,
            UiDispatcher dispatcher,
            ScheduledExecutorService scheduler,
            Runnable changed
    ) {
        this(definition, dispatcher, scheduler, DEFAULT_DEBOUNCE, changed);
    }

    BrowseSession(
            CatalogSectionDefinition<Q, R, K> definition,
            UiDispatcher dispatcher,
            ScheduledExecutorService scheduler,
            Duration debounce,
            Runnable changed
    ) {
        this.definition = Objects.requireNonNull(definition, "definition");
        this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        debounceMillis = Math.max(0L, Objects.requireNonNull(debounce, "debounce").toMillis());
        this.changed = Objects.requireNonNull(changed, "changed");
        Q initial = Objects.requireNonNull(definition.initialQuery(), "initial query");
        state = new CatalogSectionState<>(
                0L, CatalogSectionState.Lifecycle.INACTIVE, initial, initial, 0L,
                definition.pageSize(), 0, 0, definition.presentation().defaultSort(), Optional.empty(), 0L, false,
                CatalogResultState.uninitialized());
    }

    public CatalogSectionId id() {
        return definition.id();
    }

    public CatalogSectionState<Q, R, K> state() {
        return state;
    }

    public void editDraft(Q draft) {
        if (state.lifecycle() == CatalogSectionState.Lifecycle.CLOSED) {
            return;
        }
        Q next = Objects.requireNonNull(draft, "draft");
        if (next.equals(state.draft())) {
            return;
        }
        replace(next, state.committedQuery(), state.requestEpoch(), state.pageOffset(), state.totalCount(),
                state.selectedKey(), state.providerRevision(), state.stale(), state.result());
        if (isActive()) {
            scheduleCommit();
        }
    }

    public void submit() {
        if (!isActive()) {
            return;
        }
        commitDraft(state.draft());
    }

    public void commitDraft(Q draft) {
        if (!isActive()) {
            return;
        }
        cancelPendingCommit();
        Q previous = state.committedQuery();
        Q committed = Objects.requireNonNull(draft, "draft");
        replace(committed, committed, state.requestEpoch(), 0, state.totalCount(), state.selectedKey(),
                state.providerRevision(), true, state.result());
        definition.committed(previous, committed);
        beginQuery(0);
    }

    public void sort(CatalogSortOrder sortOrder) {
        if (!isActive()) {
            return;
        }
        CatalogSortOrder next = Objects.requireNonNull(sortOrder, "sortOrder");
        CatalogPresentationSpec<Q, R, K> presentation = definition.presentation();
        boolean supported = presentation.columns().stream()
                .anyMatch(column -> column.sortable() && column.id().equals(next.columnId()));
        if (!supported) {
            throw new IllegalArgumentException("Catalog sort column is not sortable: " + next.columnId());
        }
        if (next.equals(state.sortOrder())) {
            return;
        }
        cancelPendingCommit();
        CatalogResultState<R> result = presentation.sortMode() == CatalogSortMode.LOCAL
                ? sorted(state.result(), next) : state.result();
        state = new CatalogSectionState<>(state.revision() + 1L, state.lifecycle(), state.draft(),
                state.committedQuery(), state.requestEpoch(), state.pageSize(), 0, state.totalCount(), next,
                state.selectedKey(), state.providerRevision(), state.stale(), result);
        changed.run();
        if (presentation.sortMode() == CatalogSortMode.PROVIDER) {
            beginQuery(0);
        }
    }

    public void shiftPage(int direction) {
        if (!isActive()) {
            return;
        }
        int next = state.pageOffset();
        if (direction < 0) {
            next = Math.max(0, next - state.pageSize());
        } else if (direction > 0 && next + state.pageSize() < state.totalCount()) {
            next += state.pageSize();
        }
        if (next != state.pageOffset()) {
            cancelPendingCommit();
            beginQuery(next);
        }
    }

    public void select(K key) {
        if (state.lifecycle() == CatalogSectionState.Lifecycle.CLOSED) {
            return;
        }
        Optional<K> selected = Optional.ofNullable(key)
                .filter(candidate -> state.result().rows().stream()
                        .anyMatch(row -> definition.key(row).equals(candidate)));
        if (!selected.equals(state.selectedKey())) {
            replace(state.draft(), state.committedQuery(), state.requestEpoch(), state.pageOffset(),
                    state.totalCount(), selected, state.providerRevision(), state.stale(), state.result());
        }
    }

    public Optional<R> find(K key) {
        return Optional.ofNullable(key).flatMap(candidate -> state.result().rows().stream()
                .filter(row -> definition.key(row).equals(candidate)).findFirst());
    }

    @Override
    public void activate() {
        if (state.lifecycle() != CatalogSectionState.Lifecycle.INACTIVE) {
            return;
        }
        Q reconciled = Objects.requireNonNull(
                definition.reconcileOnActivate(state.committedQuery()), "activation query");
        Q draft = state.draft().equals(state.committedQuery()) ? reconciled : state.draft();
        state = new CatalogSectionState<>(state.revision() + 1L, CatalogSectionState.Lifecycle.ACTIVE,
                draft, reconciled, state.requestEpoch(), state.pageSize(), state.pageOffset(),
                state.totalCount(), state.sortOrder(), state.selectedKey(), state.providerRevision(), true,
                state.result());
        changed.run();
        try {
            long epochBeforeObservation = state.requestEpoch();
            unsubscribe = Objects.requireNonNull(
                    definition.observeProvider(change -> dispatcher.dispatch(() -> providerChanged(change))),
                    "provider unsubscribe");
            definition.activated();
            if (state.requestEpoch() == epochBeforeObservation) {
                beginQuery(state.pageOffset());
            }
        } catch (RuntimeException | Error failure) {
            Runnable acquired = unsubscribe;
            unsubscribe = null;
            if (acquired != null) {
                try {
                    acquired.run();
                } catch (RuntimeException | Error cleanupFailure) {
                    failure.addSuppressed(cleanupFailure);
                }
            }
            state = copy(CatalogSectionState.Lifecycle.INACTIVE, state.requestEpoch() + 1L, true, state.result());
            changed.run();
            throw failure;
        }
    }

    @Override
    public void deactivate() {
        if (!isActive()) {
            return;
        }
        cancelPendingCommit();
        Runnable acquired = unsubscribe;
        unsubscribe = null;
        try {
            if (acquired != null) {
                acquired.run();
            }
        } finally {
            state = copy(CatalogSectionState.Lifecycle.INACTIVE, state.requestEpoch() + 1L, true, state.result());
            changed.run();
        }
    }

    @Override
    public void close() {
        if (state.lifecycle() == CatalogSectionState.Lifecycle.CLOSED) {
            return;
        }
        deactivate();
        cancelPendingCommit();
        state = copy(CatalogSectionState.Lifecycle.CLOSED, state.requestEpoch() + 1L, state.stale(), state.result());
        changed.run();
    }

    private void providerChanged(CatalogProviderChange<Q> change) {
        if (!isActive()) {
            return;
        }
        CatalogProviderChange<Q> safe = Objects.requireNonNull(change, "provider change");
        Q draft = state.draft();
        Q committed = state.committedQuery();
        if (safe.queryChanged()) {
            draft = Objects.requireNonNull(safe.reconcileQuery().apply(draft), "reconciled draft");
            committed = Objects.requireNonNull(safe.reconcileQuery().apply(committed), "reconciled query");
            if (draft.equals(state.draft()) && committed.equals(state.committedQuery())) {
                return;
            }
        }
        replace(draft, committed, state.requestEpoch(), state.pageOffset(), state.totalCount(),
                state.selectedKey(), state.providerRevision(), true, state.result());
        beginQuery(state.pageOffset());
    }

    private void scheduleCommit() {
        cancelPendingCommit();
        pendingCommit = scheduler.schedule(
                () -> dispatcher.dispatch(this::submit), debounceMillis, TimeUnit.MILLISECONDS);
    }

    private void cancelPendingCommit() {
        ScheduledFuture<?> pending = pendingCommit;
        pendingCommit = null;
        if (pending != null) {
            pending.cancel(false);
        }
    }

    private void beginQuery(int pageOffset) {
        if (!isActive()) {
            return;
        }
        long epoch = state.requestEpoch() + 1L;
        boolean initial = state.result().status() == CatalogResultState.Status.UNINITIALIZED;
        CatalogResultState<R> pending = state.result().rows().isEmpty()
                ? CatalogResultState.loading()
                : CatalogResultState.refreshing(state.result().rows());
        replace(state.draft(), state.committedQuery(), epoch, pageOffset, state.totalCount(),
                state.selectedKey(), state.providerRevision(), true, pending);
        CatalogBrowseRequest<Q> request = new CatalogBrowseRequest<>(
                state.committedQuery(), state.sortOrder(), state.pageSize(), pageOffset, initial);
        try {
            definition.query(request).whenComplete((result, failure) -> dispatcher.dispatch(
                    () -> completeQuery(epoch, result, failure)));
        } catch (RuntimeException | Error failure) {
            completeQuery(epoch, null, failure);
        }
    }

    private void completeQuery(long epoch, CatalogBrowseResult<Q, R> response, Throwable failure) {
        if (!isActive() || epoch != state.requestEpoch()) {
            return;
        }
        if (failure != null || response == null) {
            replace(state.draft(), state.committedQuery(), epoch, state.pageOffset(), state.totalCount(),
                    state.selectedKey(), state.providerRevision(), true,
                    CatalogResultState.failed(state.result().rows(), "Katalogdaten konnten nicht geladen werden."));
            return;
        }
        CatalogResultState<R> accepted = definition.presentation().sortMode() == CatalogSortMode.LOCAL
                ? sorted(response.result(), state.sortOrder()) : response.result();
        Optional<K> selected = state.selectedKey().filter(key -> accepted.rows().stream()
                .anyMatch(row -> definition.key(row).equals(key)));
        Q acceptedQuery = response.acceptedQuery();
        Q draft = state.draft().equals(state.committedQuery()) ? acceptedQuery : state.draft();
        replace(draft, acceptedQuery, epoch, response.pageOffset(), response.totalCount(), selected,
                response.providerRevision(), false, accepted);
    }

    private boolean isActive() {
        return state.lifecycle() == CatalogSectionState.Lifecycle.ACTIVE;
    }

    private CatalogSectionState<Q, R, K> copy(
            CatalogSectionState.Lifecycle lifecycle,
            long epoch,
            boolean stale,
            CatalogResultState<R> result
    ) {
        return new CatalogSectionState<>(state.revision() + 1L, lifecycle, state.draft(),
                state.committedQuery(), epoch, state.pageSize(), state.pageOffset(), state.totalCount(),
                state.sortOrder(), state.selectedKey(), state.providerRevision(), stale, result);
    }

    private void replace(
            Q draft,
            Q committed,
            long epoch,
            int pageOffset,
            int totalCount,
            Optional<K> selected,
            long providerRevision,
            boolean stale,
            CatalogResultState<R> result
    ) {
        state = new CatalogSectionState<>(state.revision() + 1L, state.lifecycle(), draft, committed, epoch,
                state.pageSize(), pageOffset, totalCount, state.sortOrder(), selected, providerRevision, stale,
                result);
        changed.run();
    }

    private CatalogResultState<R> sorted(CatalogResultState<R> result, CatalogSortOrder order) {
        CatalogColumnSpec<R> column = definition.presentation().columns().stream()
                .filter(candidate -> candidate.id().equals(order.columnId()) && candidate.sortable())
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Catalog sort column is not sortable: " + order.columnId()));
        Comparator<R> comparator = Comparator.comparing(
                row -> Objects.requireNonNullElse(column.value().apply(row), "").toLowerCase(Locale.ROOT));
        if (order.direction() == CatalogSortOrder.Direction.DESCENDING) {
            comparator = comparator.reversed();
        }
        List<R> rows = result.rows().stream().sorted(comparator).toList();
        return new CatalogResultState<>(result.status(), rows, result.message());
    }
}
