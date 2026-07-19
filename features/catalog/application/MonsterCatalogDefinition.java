package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.CreatureInspectorRoute;
import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.SceneHandoff;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureCatalogQuery;
import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureFilterOptions;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReadStatus;
import features.encounter.api.EncounterPoolFiltersModel;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableReadStatus;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/** Monster provider translation and explicit actions; browse lifecycle remains in BrowseSession. */
public final class MonsterCatalogDefinition
        implements CatalogSectionDefinition<MonsterCatalogQuery, CreatureCatalogRow, Long> {

    private final CreatureCatalogQueryApi queries;
    private final EncounterPoolFiltersModel poolFilters;
    private final WorldPlannerSnapshotModel world;
    private final EncounterTableCatalogModel encounterTables;
    private final CreatureInspectorRoute inspector;
    private final EncounterHandoff encounter;
    private final SceneHandoff scene;
    private final AtomicLong providerRevision = new AtomicLong();

    public MonsterCatalogDefinition(
            CreatureCatalogQueryApi queries,
            EncounterPoolFiltersModel poolFilters,
            WorldPlannerSnapshotModel world,
            EncounterTableCatalogModel encounterTables,
            CreatureInspectorRoute inspector,
            EncounterHandoff encounter,
            SceneHandoff scene
    ) {
        this.queries = Objects.requireNonNull(queries, "queries");
        this.poolFilters = Objects.requireNonNull(poolFilters, "poolFilters");
        this.world = Objects.requireNonNull(world, "world");
        this.encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
        this.scene = Objects.requireNonNull(scene, "scene");
    }

    @Override public CatalogSectionId id() {
        return CatalogSectionId.MONSTERS;
    }

    @Override public MonsterCatalogQuery initialQuery() {
        return MonsterCatalogQuery.initial();
    }

    @Override public MonsterCatalogQuery reconcileOnActivate(MonsterCatalogQuery retainedQuery) {
        return retainedQuery.withFilters(MonsterCatalogFilterDraft.from(poolFilters.current()));
    }

    @Override
    public CompletionStage<CatalogBrowseResult<MonsterCatalogQuery, CreatureCatalogRow>> query(
            CatalogBrowseRequest<MonsterCatalogQuery> request
    ) {
        MonsterCatalogQuery query = request.query();
        CreatureCatalogQuery providerQuery = new CreatureCatalogQuery(
                query.filters().nameQuery(), query.filters().challengeRatingMin(),
                query.filters().challengeRatingMax(), query.filters().sizes(),
                query.filters().creatureTypes(), query.filters().creatureSubtypes(),
                query.filters().biomes(), query.filters().alignments(),
                query.sort().providerField(), query.sort().providerDirection(),
                request.pageSize(), request.pageOffset());
        CompletionStage<CreatureFilterOptions> options = queries.loadFilterOptions()
                .handle((result, failure) -> failure == null && result != null
                        && result.status() == CreatureReadStatus.SUCCESS
                        ? result.options() : CreatureFilterOptions.empty());
        CompletionStage<CreatureCatalogPageResult> page = queries.search(providerQuery);
        return options.thenCombine(page, (acceptedOptions, providerResult) -> {
            CreatureCatalogPage acceptedPage = providerResult == null || providerResult.page() == null
                    ? CreatureCatalogPage.empty(request.pageSize(), request.pageOffset())
                    : providerResult.page();
            CatalogResultState<CreatureCatalogRow> result;
            if (providerResult == null || providerResult.status() == CreatureQueryStatus.STORAGE_ERROR) {
                result = CatalogResultState.failed("Monster konnten nicht geladen werden.");
            } else if (providerResult.status() == CreatureQueryStatus.INVALID_QUERY) {
                result = new CatalogResultState<>(
                        CatalogResultState.Status.INVALID_INPUT, List.of(), "Filter sind ungültig.");
            } else {
                result = CatalogResultState.ready(acceptedPage.rows());
            }
            MonsterCatalogQuery acceptedQuery = query.withOptions(acceptedOptions).withReferenceOptions(
                    encounterTables.current().status() == EncounterTableReadStatus.SUCCESS
                            ? encounterTables.current().tables().stream()
                                    .map(table -> new CatalogReferenceOption(table.tableId(), table.name())).toList()
                            : List.of(),
                    WorldCatalogProjection.factionOptions(world.current()),
                    WorldCatalogProjection.locationOptions(world.current()));
            return new CatalogBrowseResult<>(acceptedQuery, result,
                    acceptedPage.pageOffset(), acceptedPage.totalCount(), providerRevision.incrementAndGet());
        });
    }

    @Override public Long key(CreatureCatalogRow row) {
        return row.id();
    }

    @Override public void committed(MonsterCatalogQuery previous, MonsterCatalogQuery committed) {
        if (!previous.filters().toPoolFilters().equals(committed.filters().toPoolFilters())) {
            encounter.updatePoolFilters(committed.filters().toPoolFilters());
        }
    }

    @Override
    public Runnable observeProvider(Consumer<CatalogProviderChange<MonsterCatalogQuery>> listener) {
        return poolFilters.subscribe(filters -> {
            providerRevision.incrementAndGet();
            listener.accept(CatalogProviderChange.queryChanged(
                    query -> query.withFilters(MonsterCatalogFilterDraft.from(filters))));
        });
    }

    public void open(long creatureId) {
        if (creatureId > 0L) {
            inspector.openCreature(creatureId);
        }
    }

    public void addToEncounter(long creatureId) {
        if (creatureId > 0L) {
            encounter.addCreature(creatureId);
        }
    }

    public void addToScene(long creatureId) {
        if (creatureId > 0L) {
            scene.addCreature(creatureId);
        }
    }

}
