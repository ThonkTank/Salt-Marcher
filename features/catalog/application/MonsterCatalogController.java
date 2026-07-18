package features.catalog.application;

import features.creatures.api.CreatureCatalogQueryApi;
import features.encounter.api.EncounterBuilderInputsModel;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureFilterOptionsResult;
import features.creatures.api.CreatureQueryStatus;
import features.encounter.api.EncounterBuilderInputs;
import java.util.Objects;

public final class MonsterCatalogController implements CatalogLifecycle {

    private final CreatureCatalogQueryApi queries;
    private final EncounterBuilderInputsModel encounterPoolFilters;
    private final Runnable changed;
    private MonsterCatalogState state = MonsterCatalogState.initial();
    private Runnable unsubscribe = () -> { };
    private long lifecycleEpoch;
    private boolean active;

    MonsterCatalogController(
            CreatureCatalogQueryApi queries,
            EncounterBuilderInputsModel encounterPoolFilters,
            Runnable changed
    ) {
        this.queries = Objects.requireNonNull(queries, "queries");
        this.encounterPoolFilters = Objects.requireNonNull(encounterPoolFilters, "encounterPoolFilters");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public MonsterCatalogState state() {
        return state;
    }

    CreatureCatalogQueryApi queries() {
        return queries;
    }

    @Override
    public void activate() {
        if (active) {
            return;
        }
        active = true;
        long epoch = ++lifecycleEpoch;
        unsubscribe = CurrentFirstSubscription.open(
                encounterPoolFilters::current,
                encounterPoolFilters::subscribe,
                inputs -> {
                    if (active && lifecycleEpoch == epoch) {
                        applyEncounterInputs(inputs);
                    }
                });
    }

    private void applyEncounterInputs(EncounterBuilderInputs inputs) {
        state = new MonsterCatalogState(
                state.results(), state.filterOptions(), Objects.requireNonNull(inputs, "inputs"),
                state.selectedCreatureId(), state.pageOffset(), state.unfinishedInput());
        changed.run();
    }

    void applySearchResult(CreatureCatalogPageResult result, Throwable failure) {
        CreatureCatalogPageResult safe = failure == null ? result : null;
        CreatureCatalogPage page = safe == null || safe.page() == null
                ? CreatureCatalogPage.empty(50, state.pageOffset()) : safe.page();
        CatalogResultState<features.creatures.api.CreatureCatalogRow> results;
        if (safe == null || safe.status() == CreatureQueryStatus.STORAGE_ERROR) {
            results = CatalogResultState.failed("Monster konnten nicht geladen werden.");
        } else if (safe.status() == CreatureQueryStatus.INVALID_QUERY) {
            results = new CatalogResultState<>(
                    CatalogResultState.Status.INVALID_INPUT, java.util.List.of(), "Filter sind ungültig.");
        } else {
            results = CatalogResultState.ready(page.rows());
        }
        state = new MonsterCatalogState(
                results, state.filterOptions(), state.encounterPoolFilters(),
                state.selectedCreatureId(), page.pageOffset(), state.unfinishedInput());
        changed.run();
    }

    void applyFilterOptions(CreatureFilterOptionsResult result, Throwable failure) {
        CreatureFilterOptionsResult safe = failure == null ? result : null;
        state = new MonsterCatalogState(
                state.results(),
                safe == null ? features.creatures.api.CreatureFilterOptions.empty() : safe.options(),
                state.encounterPoolFilters(), state.selectedCreatureId(),
                state.pageOffset(), state.unfinishedInput());
        changed.run();
    }

    @Override
    public void deactivate() {
        if (!active) {
            return;
        }
        active = false;
        lifecycleEpoch++;
        unsubscribe.run();
        unsubscribe = () -> { };
    }

    @Override
    public void close() {
        deactivate();
    }
}
