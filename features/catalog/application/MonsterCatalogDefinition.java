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
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Optional;

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

    @Override
    public CatalogPresentationSpec<MonsterCatalogQuery, CreatureCatalogRow, Long> presentation() {
        List<CatalogFilterSpec<MonsterCatalogQuery>> filters = List.of(
                new CatalogFilterSpec.Text<>(
                        "Monster suchen …", "Monster suchen", query -> query.filters().nameQuery(),
                        (query, value) -> query.withFilters(query.filters().withNameQuery(value)),
                        query -> query.filters().nameQuery().isBlank()
                                ? "" : "Suche: " + query.filters().nameQuery(),
                        query -> query.withFilters(query.filters().withNameQuery(""))),
                new CatalogFilterSpec.ChoiceRange<>(
                        "CR", "Challenge Rating",
                        query -> CatalogPresentationChoices.strings(query.options().challengeRatings()),
                        query -> query.filters().challengeRatingMin(),
                        query -> query.filters().challengeRatingMax(),
                        (query, minimum, maximum) -> query.withFilters(
                                query.filters().withChallengeRating(minimum, maximum)),
                        query -> query.filters().challengeRatingMin().isBlank()
                                && query.filters().challengeRatingMax().isBlank() ? ""
                                : "CR: " + query.filters().challengeRatingMin() + "–"
                                        + query.filters().challengeRatingMax(),
                        query -> query.withFilters(query.filters().withChallengeRating("", ""))),
                multiString("Größe", "Monster-Größe", query -> query.options().sizes(),
                        query -> query.filters().sizes(),
                        (query, values) -> query.withFilters(query.filters().withSizes(values))),
                multiString("Typ", "Monster-Typ", query -> query.options().types(),
                        query -> query.filters().creatureTypes(),
                        (query, values) -> query.withFilters(query.filters().withCreatureTypes(values))),
                multiString("Unterart", "Monster-Unterart", query -> query.options().subtypes(),
                        query -> query.filters().creatureSubtypes(),
                        (query, values) -> query.withFilters(query.filters().withCreatureSubtypes(values))),
                multiString("Umgebung", "Monster-Umgebung", query -> query.options().biomes(),
                        query -> query.filters().biomes(),
                        (query, values) -> query.withFilters(query.filters().withBiomes(values))),
                multiString("Gesinnung", "Monster-Gesinnung", query -> query.options().alignments(),
                        query -> query.filters().alignments(),
                        (query, values) -> query.withFilters(query.filters().withAlignments(values))),
                new CatalogFilterSpec.MultiChoice<>(
                        "Tabelle", "Encounter-Tabellen",
                        query -> CatalogPresentationChoices.references(query.encounterTables()).stream()
                                .filter(choice -> choice.value() > 0L).toList(),
                        query -> query.filters().encounterTableIds(),
                        (query, values) -> query.withFilters(query.filters().withEncounterTables(values)),
                        query -> CatalogPresentationChoices.count(
                                "Tabellen", query.filters().encounterTableIds().size()),
                        query -> query.withFilters(query.filters().withEncounterTables(List.of()))),
                new CatalogFilterSpec.MultiChoice<>(
                        "Fraktionen", "World-Fraktionen",
                        query -> CatalogPresentationChoices.references(query.factions()).stream()
                                .filter(choice -> choice.value() > 0L).toList(),
                        query -> query.filters().worldFactionIds(),
                        (query, values) -> query.withFilters(query.filters().withFactions(values)),
                        query -> CatalogPresentationChoices.count(
                                "Fraktionen", query.filters().worldFactionIds().size()),
                        query -> query.withFilters(query.filters().withFactions(List.of()))),
                new CatalogFilterSpec.Choice<>(
                        "Ort", "World-Ort", query -> CatalogPresentationChoices.references(query.locations()),
                        query -> query.filters().worldLocationId(),
                        (query, value) -> query.withFilters(query.filters().withLocation(value)),
                        query -> query.filters().worldLocationId() <= 0L
                                ? "" : "Ort: #" + query.filters().worldLocationId(),
                        query -> query.withFilters(query.filters().withLocation(0L))),
                new CatalogFilterSpec.Choice<>(
                        "Sortierung", "Monster sortieren",
                        ignored -> java.util.Arrays.stream(MonsterCatalogSort.values())
                                .map(value -> new CatalogChoice<>(value, value.label())).toList(),
                        MonsterCatalogQuery::sort, MonsterCatalogQuery::withSort,
                        ignored -> "", java.util.function.UnaryOperator.identity()));
        return new CatalogPresentationSpec<>(
                "Monster-Ergebnisse", "Monster", CreatureCatalogRow::name, filters,
                List.of(
                        new CatalogColumnSpec<>("Name", CreatureCatalogRow::name),
                        new CatalogColumnSpec<>("CR", CreatureCatalogRow::challengeRating),
                        new CatalogColumnSpec<>("Typ", CreatureCatalogRow::creatureType),
                        new CatalogColumnSpec<>("Größe", CreatureCatalogRow::size),
                        new CatalogColumnSpec<>("XP", row ->
                                NumberFormat.getIntegerInstance(Locale.US).format(row.xp()))),
                Optional.of(new CatalogActionSpec(
                        CatalogActionId.OPEN, "Details öffnen", "Monster im Inspector öffnen", "Öffnen",
                        CatalogActionSpec.Emphasis.SECONDARY)),
                List.of(
                        new CatalogActionSpec(
                                CatalogActionId.ADD_TO_ENCOUNTER, "+ Encounter", "Zum Encounter hinzufügen",
                                "+ Encounter", CatalogActionSpec.Emphasis.PRIMARY),
                        new CatalogActionSpec(
                                CatalogActionId.ADD_TO_SCENE, "+ Scene", "Zur fokussierten Scene hinzufügen",
                                "+ Scene", CatalogActionSpec.Emphasis.SECONDARY)),
                List.of(), true);
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

    private static CatalogFilterSpec.MultiChoice<MonsterCatalogQuery, String> multiString(
            String prompt,
            String accessible,
            java.util.function.Function<MonsterCatalogQuery, List<String>> options,
            java.util.function.Function<MonsterCatalogQuery, List<String>> selected,
            java.util.function.BiFunction<MonsterCatalogQuery, List<String>, MonsterCatalogQuery> update
    ) {
        return new CatalogFilterSpec.MultiChoice<>(
                prompt, accessible,
                query -> CatalogPresentationChoices.requiredStrings(options.apply(query)),
                selected, update,
                query -> CatalogPresentationChoices.count(prompt, selected.apply(query).size()),
                query -> update.apply(query, List.of()));
    }

}
