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
    private final CatalogSuccessfulAsyncCache<CreatureFilterOptions> filterOptions =
            new CatalogSuccessfulAsyncCache<>();

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
                providerSortField(request.sortOrder()), request.sortOrder().direction().name(),
                request.pageSize(), request.pageOffset());
        CompletionStage<Optional<CreatureFilterOptions>> options = query.filterOptionsResolved()
                ? CompletableFuture.completedFuture(Optional.of(query.options()))
                : filterOptions.resolve(() -> queries.loadFilterOptions().thenApply(result ->
                        result != null && result.status() == CreatureReadStatus.SUCCESS
                                ? Optional.of(result.options()) : Optional.empty()));
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
            if (acceptedOptions.isEmpty()
                    && (result.status() == CatalogResultState.Status.READY
                            || result.status() == CatalogResultState.Status.EMPTY)) {
                result = CatalogResultState.failed(
                        result.rows(), "Monster-Filter konnten nicht geladen werden.");
            }
            MonsterCatalogQuery acceptedQuery = acceptedOptions.map(query::withOptions).orElse(query)
                    .withReferenceOptions(
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
                        query -> CatalogFilterTokens.single(
                                query.filters().nameQuery().isBlank()
                                        ? "" : "Suche: " + query.filters().nameQuery(),
                                current -> current.withFilters(current.filters().withNameQuery(""))),
                        query -> query.withFilters(query.filters().withNameQuery(""))),
                new CatalogFilterSpec.ChoiceRange<>(
                        "CR", "Challenge Rating",
                        query -> CatalogPresentationChoices.strings(query.options().challengeRatings()),
                        query -> query.filters().challengeRatingMin(),
                        query -> query.filters().challengeRatingMax(),
                        (query, minimum, maximum) -> query.withFilters(
                                query.filters().withChallengeRating(minimum, maximum)),
                        query -> CatalogFilterTokens.single(
                                query.filters().challengeRatingMin().isBlank()
                                        && query.filters().challengeRatingMax().isBlank() ? ""
                                        : "CR: " + query.filters().challengeRatingMin() + "–"
                                                + query.filters().challengeRatingMax(),
                                current -> current.withFilters(
                                        current.filters().withChallengeRating("", ""))),
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
                        query -> CatalogFilterTokens.each(
                                query, current -> current.filters().encounterTableIds(),
                                value -> referenceLabel(query.encounterTables(), value),
                                (current, values) -> current.withFilters(
                                        current.filters().withEncounterTables(values))),
                        query -> query.withFilters(query.filters().withEncounterTables(List.of()))),
                new CatalogFilterSpec.MultiChoice<>(
                        "Fraktionen", "World-Fraktionen",
                        query -> CatalogPresentationChoices.references(query.factions()).stream()
                                .filter(choice -> choice.value() > 0L).toList(),
                        query -> query.filters().worldFactionIds(),
                        (query, values) -> query.withFilters(query.filters().withFactions(values)),
                        query -> CatalogFilterTokens.each(
                                query, current -> current.filters().worldFactionIds(),
                                value -> referenceLabel(query.factions(), value),
                                (current, values) -> current.withFilters(current.filters().withFactions(values))),
                        query -> query.withFilters(query.filters().withFactions(List.of()))),
                new CatalogFilterSpec.Choice<>(
                        "Ort", "World-Ort", query -> CatalogPresentationChoices.references(query.locations()),
                        query -> query.filters().worldLocationId(),
                        (query, value) -> query.withFilters(query.filters().withLocation(value)),
                        query -> CatalogFilterTokens.single(
                                query.filters().worldLocationId() <= 0L ? ""
                                        : referenceLabel(query.locations(), query.filters().worldLocationId()),
                                current -> current.withFilters(current.filters().withLocation(0L))),
                        query -> query.withFilters(query.filters().withLocation(0L))));
        return new CatalogPresentationSpec<>(
                "Monster-Ergebnisse", "Monster", CreatureCatalogRow::name, filters,
                List.of(
                        new CatalogColumnSpec<>("name", "Name", CreatureCatalogRow::name, true),
                        new CatalogColumnSpec<>(
                                "challenge-rating", "CR", CreatureCatalogRow::challengeRating, true),
                        new CatalogColumnSpec<>("type", "Typ", CreatureCatalogRow::creatureType, false),
                        new CatalogColumnSpec<>("size", "Größe", CreatureCatalogRow::size, false),
                        new CatalogColumnSpec<>("xp", "XP", row ->
                                NumberFormat.getIntegerInstance(Locale.US).format(row.xp()), true)),
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
                List.of(CatalogActionSpec.create()), true,
                new CatalogSortOrder("name", CatalogSortOrder.Direction.ASCENDING),
                CatalogSortMode.PROVIDER);
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
                query -> CatalogFilterTokens.each(query, selected, value -> value, update),
                query -> update.apply(query, List.of()));
    }

    private static String referenceLabel(List<CatalogReferenceOption> options, long id) {
        return options.stream().filter(option -> option.id() == id).map(CatalogReferenceOption::label)
                .findFirst().orElse("#" + id);
    }

    private static String providerSortField(CatalogSortOrder sortOrder) {
        return switch (sortOrder.columnId()) {
            case "name" -> "NAME";
            case "challenge-rating" -> "CHALLENGE_RATING";
            case "xp" -> "XP";
            default -> throw new IllegalArgumentException(
                    "Unsupported Monster provider sort: " + sortOrder.columnId());
        };
    }

}
