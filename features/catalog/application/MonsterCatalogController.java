package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.CreatureInspectorRoute;
import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.SceneHandoff;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureFilterOptions;
import features.creatures.api.CreatureFilterOptionsResult;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReadStatus;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.EncounterPoolFiltersModel;
import java.util.List;
import java.util.Objects;
import platform.ui.UiDispatcher;

/** Owns every Monster state transition, provider request, and outward intent. */
public final class MonsterCatalogController implements CatalogLifecycle {

    private final CreatureCatalogQueryApi queries;
    private final EncounterPoolFiltersModel poolFilters;
    private final CreatureInspectorRoute inspector;
    private final EncounterHandoff encounter;
    private final SceneHandoff scene;
    private final UiDispatcher dispatcher;
    private final Runnable changed;
    private MonsterCatalogState state = MonsterCatalogState.initial();
    private Runnable unsubscribe = () -> { };
    private boolean applyingInitialReadback;

    MonsterCatalogController(
            CreatureCatalogQueryApi queries,
            EncounterPoolFiltersModel poolFilters,
            CreatureInspectorRoute inspector,
            EncounterHandoff encounter,
            SceneHandoff scene,
            UiDispatcher dispatcher,
            Runnable changed
    ) {
        this.queries = Objects.requireNonNull(queries, "queries");
        this.poolFilters = Objects.requireNonNull(poolFilters, "poolFilters");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
        this.scene = Objects.requireNonNull(scene, "scene");
        this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public MonsterCatalogState state() {
        return state;
    }

    public void accept(MonsterCatalogIntent intent) {
        if (intent == null || state.lifecycle() == MonsterCatalogState.Lifecycle.CLOSED) {
            return;
        }
        switch (intent) {
            case MonsterCatalogIntent.ChangeFilters change -> changeFilters(change.filters());
            case MonsterCatalogIntent.ChangeSort change -> changeSort(change.sort());
            case MonsterCatalogIntent.ShiftPage shift -> shiftPage(shift.direction());
            case MonsterCatalogIntent.SelectCreature selection -> select(selection.creatureId());
            case MonsterCatalogIntent.OpenCreature open -> open(open.creatureId());
            case MonsterCatalogIntent.AddToEncounter add -> addToEncounter(add.creatureId());
            case MonsterCatalogIntent.AddToScene add -> addToScene(add.creatureId());
            case MonsterCatalogIntent.Refresh ignored -> beginSearch();
        }
    }

    @Override
    public void activate() {
        if (state.lifecycle() != MonsterCatalogState.Lifecycle.INACTIVE) {
            return;
        }
        replace(
                state.lifecycleRevision() + 1L,
                state.requestRevision(),
                MonsterCatalogState.Lifecycle.ACTIVE,
                state.filterDraft(), state.filterOptions(), state.sort(), state.pageOffset(),
                state.totalCount(), state.selectedCreatureId(), state.results());
        applyingInitialReadback = true;
        try {
            unsubscribe = CurrentFirstSubscription.open(
                    poolFilters::current,
                    poolFilters::subscribe,
                    this::reconcileReadback);
        } finally {
            applyingInitialReadback = false;
        }
        loadFilterOptions();
        beginSearch();
    }

    @Override
    public void deactivate() {
        if (state.lifecycle() != MonsterCatalogState.Lifecycle.ACTIVE) {
            return;
        }
        unsubscribe.run();
        unsubscribe = () -> { };
        replace(
                state.lifecycleRevision() + 1L,
                state.requestRevision() + 1L,
                MonsterCatalogState.Lifecycle.INACTIVE,
                state.filterDraft(), state.filterOptions(), state.sort(), state.pageOffset(),
                state.totalCount(), state.selectedCreatureId(), state.results());
    }

    @Override
    public void close() {
        if (state.lifecycle() == MonsterCatalogState.Lifecycle.CLOSED) {
            return;
        }
        deactivate();
        replace(
                state.lifecycleRevision() + 1L,
                state.requestRevision() + 1L,
                MonsterCatalogState.Lifecycle.CLOSED,
                state.filterDraft(), state.filterOptions(), state.sort(), state.pageOffset(),
                state.totalCount(), state.selectedCreatureId(), state.results());
    }

    private void changeFilters(MonsterCatalogFilterDraft draft) {
        MonsterCatalogFilterDraft next = Objects.requireNonNull(draft, "draft");
        if (next.equals(state.filterDraft())) {
            return;
        }
        replaceKeepingLifecycle(next, state.filterOptions(), state.sort(), 0, state.totalCount(),
                state.selectedCreatureId(), state.results());
        encounter.updatePoolFilters(next.toPoolFilters());
        beginSearch();
    }

    private void reconcileReadback(EncounterPoolFilters readback) {
        MonsterCatalogFilterDraft next = MonsterCatalogFilterDraft.from(readback);
        if (next.toPoolFilters().equals(state.filterDraft().toPoolFilters())) {
            return;
        }
        replaceKeepingLifecycle(next, state.filterOptions(), state.sort(), 0, state.totalCount(),
                state.selectedCreatureId(), state.results());
        if (!applyingInitialReadback && state.lifecycle() == MonsterCatalogState.Lifecycle.ACTIVE) {
            beginSearch();
        }
    }

    private void changeSort(MonsterCatalogSort sort) {
        if (sort == state.sort()) {
            return;
        }
        replaceKeepingLifecycle(state.filterDraft(), state.filterOptions(), sort, 0, state.totalCount(),
                state.selectedCreatureId(), state.results());
        beginSearch();
    }

    private void shiftPage(int direction) {
        int nextOffset = state.pageOffset();
        if (direction < 0) {
            nextOffset = Math.max(0, nextOffset - state.pageSize());
        } else if (direction > 0 && nextOffset + state.pageSize() < state.totalCount()) {
            nextOffset += state.pageSize();
        }
        if (nextOffset == state.pageOffset()) {
            return;
        }
        replaceKeepingLifecycle(state.filterDraft(), state.filterOptions(), state.sort(), nextOffset,
                state.totalCount(), state.selectedCreatureId(), state.results());
        beginSearch();
    }

    private void select(long creatureId) {
        long selected = Math.max(0L, creatureId);
        if (selected == state.selectedCreatureId()) {
            return;
        }
        replaceKeepingLifecycle(state.filterDraft(), state.filterOptions(), state.sort(), state.pageOffset(),
                state.totalCount(), selected, state.results());
    }

    private void open(long creatureId) {
        if (creatureId > 0L) {
            inspector.openCreature(creatureId);
        }
    }

    private void addToEncounter(long creatureId) {
        if (creatureId > 0L) {
            encounter.addCreature(creatureId);
        }
    }

    private void addToScene(long creatureId) {
        if (creatureId > 0L) {
            scene.addCreature(creatureId);
        }
    }

    private void beginSearch() {
        if (state.lifecycle() != MonsterCatalogState.Lifecycle.ACTIVE) {
            return;
        }
        long requestRevision = state.requestRevision() + 1L;
        long lifecycleRevision = state.lifecycleRevision();
        replace(
                lifecycleRevision, requestRevision, state.lifecycle(), state.filterDraft(),
                state.filterOptions(), state.sort(), state.pageOffset(), state.totalCount(),
                state.selectedCreatureId(), CatalogResultState.loading());
        queries.search(state.query()).whenComplete((result, failure) -> dispatcher.dispatch(() ->
                completeSearch(lifecycleRevision, requestRevision, result, failure)));
    }

    private void completeSearch(
            long lifecycleRevision,
            long requestRevision,
            CreatureCatalogPageResult result,
            Throwable failure
    ) {
        if (!accepts(lifecycleRevision, requestRevision)) {
            return;
        }
        CreatureCatalogPage page = result == null || result.page() == null
                ? CreatureCatalogPage.empty(state.pageSize(), state.pageOffset()) : result.page();
        CatalogResultState<CreatureCatalogRow> results;
        if (failure != null || result == null || result.status() == CreatureQueryStatus.STORAGE_ERROR) {
            results = CatalogResultState.failed("Monster konnten nicht geladen werden.");
        } else if (result.status() == CreatureQueryStatus.INVALID_QUERY) {
            results = new CatalogResultState<>(
                    CatalogResultState.Status.INVALID_INPUT, List.of(), "Filter sind ungültig.");
        } else {
            results = CatalogResultState.ready(page.rows());
        }
        long selected = page.rows().stream().anyMatch(row -> row.id() == state.selectedCreatureId())
                ? state.selectedCreatureId() : 0L;
        replaceKeepingLifecycle(state.filterDraft(), state.filterOptions(), state.sort(), page.pageOffset(),
                page.totalCount(), selected, results);
    }

    private void loadFilterOptions() {
        long lifecycleRevision = state.lifecycleRevision();
        queries.loadFilterOptions().whenComplete((result, failure) -> dispatcher.dispatch(() -> {
            if (state.lifecycle() != MonsterCatalogState.Lifecycle.ACTIVE
                    || state.lifecycleRevision() != lifecycleRevision) {
                return;
            }
            CreatureFilterOptions options = failure == null
                    && result != null
                    && result.status() == CreatureReadStatus.SUCCESS
                    ? result.options() : CreatureFilterOptions.empty();
            replaceKeepingLifecycle(state.filterDraft(), options, state.sort(), state.pageOffset(),
                    state.totalCount(), state.selectedCreatureId(), state.results());
        }));
    }

    private boolean accepts(long lifecycleRevision, long requestRevision) {
        return state.lifecycle() == MonsterCatalogState.Lifecycle.ACTIVE
                && state.lifecycleRevision() == lifecycleRevision
                && state.requestRevision() == requestRevision;
    }

    private void replaceKeepingLifecycle(
            MonsterCatalogFilterDraft draft,
            CreatureFilterOptions options,
            MonsterCatalogSort sort,
            int pageOffset,
            int totalCount,
            long selectedCreatureId,
            CatalogResultState<CreatureCatalogRow> results
    ) {
        replace(state.lifecycleRevision(), state.requestRevision(), state.lifecycle(), draft, options, sort,
                pageOffset, totalCount, selectedCreatureId, results);
    }

    private void replace(
            long lifecycleRevision,
            long requestRevision,
            MonsterCatalogState.Lifecycle lifecycle,
            MonsterCatalogFilterDraft draft,
            CreatureFilterOptions options,
            MonsterCatalogSort sort,
            int pageOffset,
            int totalCount,
            long selectedCreatureId,
            CatalogResultState<CreatureCatalogRow> results
    ) {
        state = new MonsterCatalogState(
                state.revision() + 1L, lifecycleRevision, requestRevision, lifecycle, draft, options, sort,
                state.pageSize(), pageOffset, totalCount, selectedCreatureId, results);
        changed.run();
    }
}
