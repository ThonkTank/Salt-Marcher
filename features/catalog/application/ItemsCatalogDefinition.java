package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.ItemInspectorRoute;
import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import java.util.Optional;

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

    @Override
    public CatalogPresentationSpec<ItemsCatalogQuery, ItemsCatalogApi.ItemRow, String> presentation() {
        List<CatalogFilterSpec<ItemsCatalogQuery>> filters = List.of(
                new CatalogFilterSpec.Text<>(
                        "Name enthält …", "Item-Name", query -> query.filters().name(),
                        (query, value) -> query.withFilters(query.filters().withName(value)),
                        query -> query.filters().name().isBlank() ? "" : "Name: " + query.filters().name(),
                        query -> query.withFilters(query.filters().withName(""))),
                stringChoice("Kategorie", "Item-Kategorie", query -> query.options().categories(),
                        query -> query.filters().category(),
                        (query, value) -> query.withFilters(query.filters().withCategory(value))),
                stringChoice("Unterkategorie", "Item-Unterkategorie", query -> query.options().subcategories(),
                        query -> query.filters().subcategory(),
                        (query, value) -> query.withFilters(query.filters().withSubcategory(value))),
                stringChoice("Seltenheit", "Item-Seltenheit", query -> query.options().rarities(),
                        query -> query.filters().rarity(),
                        (query, value) -> query.withFilters(query.filters().withRarity(value))),
                triState("Magisch", "Item-Magie", query -> query.filters().magic(),
                        (query, value) -> query.withFilters(query.filters().withMagic(value))),
                triState("Attunement", "Item-Attunement", query -> query.filters().attunement(),
                        (query, value) -> query.withFilters(query.filters().withAttunement(value))),
                new CatalogFilterSpec.TextRange<>(
                        "Kosten (CP)", "Item-Kosten", query -> query.filters().minimumCostCp(),
                        query -> query.filters().maximumCostCp(),
                        (query, minimum, maximum) -> query.withFilters(
                                query.filters().withCostRange(minimum, maximum)),
                        query -> query.filters().minimumCostCp().isBlank()
                                && query.filters().maximumCostCp().isBlank() ? ""
                                : "Kosten: " + query.filters().minimumCostCp() + "–"
                                        + query.filters().maximumCostCp() + " CP",
                        query -> query.withFilters(query.filters().withCostRange("", ""))),
                new CatalogFilterSpec.Choice<>(
                        "Sortierung", "Item-Sortierfeld",
                        ignored -> List.of(
                                new CatalogChoice<>(ItemsCatalogApi.SortField.NAME, "Name"),
                                new CatalogChoice<>(ItemsCatalogApi.SortField.CATEGORY, "Kategorie"),
                                new CatalogChoice<>(ItemsCatalogApi.SortField.RARITY, "Seltenheit"),
                                new CatalogChoice<>(ItemsCatalogApi.SortField.COST, "Kosten")),
                        query -> query.filters().sortField(),
                        (query, value) -> query.withFilters(query.filters().withSortField(value)),
                        ignored -> "", java.util.function.UnaryOperator.identity()),
                new CatalogFilterSpec.Choice<>(
                        "Richtung", "Item-Sortierrichtung",
                        ignored -> List.of(new CatalogChoice<>(Boolean.TRUE, "Aufsteigend"),
                                new CatalogChoice<>(Boolean.FALSE, "Absteigend")),
                        query -> query.filters().ascending(),
                        (query, value) -> query.withFilters(query.filters().withAscending(value)),
                        ignored -> "", java.util.function.UnaryOperator.identity()));
        return new CatalogPresentationSpec<>(
                "Item-Ergebnisse", "Items", ItemsCatalogApi.ItemRow::name, filters,
                List.of(
                        new CatalogColumnSpec<>("Name", ItemsCatalogApi.ItemRow::name),
                        new CatalogColumnSpec<>("Kategorie", row -> joined(row.category(), row.subcategory())),
                        new CatalogColumnSpec<>("Seltenheit", row -> shown(row.rarity())),
                        new CatalogColumnSpec<>("Magie", row -> row.magic() ? "Ja" : "Nein"),
                        new CatalogColumnSpec<>("Kosten", row -> shown(row.costDisplay()))),
                Optional.of(new CatalogActionSpec(
                        CatalogActionId.OPEN, "Details öffnen", "Item im Inspector öffnen", "Öffnen",
                        CatalogActionSpec.Emphasis.SECONDARY)),
                List.of(), List.of(), true);
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

    private static CatalogFilterSpec.Choice<ItemsCatalogQuery, String> stringChoice(
            String prompt,
            String accessible,
            java.util.function.Function<ItemsCatalogQuery, List<String>> options,
            java.util.function.Function<ItemsCatalogQuery, String> selected,
            java.util.function.BiFunction<ItemsCatalogQuery, String, ItemsCatalogQuery> update
    ) {
        return new CatalogFilterSpec.Choice<>(
                prompt, accessible, query -> CatalogPresentationChoices.strings(options.apply(query)),
                selected, update,
                query -> selected.apply(query).isBlank() ? "" : prompt + ": " + selected.apply(query),
                query -> update.apply(query, ""));
    }

    private static CatalogFilterSpec.TriState<ItemsCatalogQuery> triState(
            String prompt,
            String accessible,
            java.util.function.Function<ItemsCatalogQuery, Boolean> selected,
            java.util.function.BiFunction<ItemsCatalogQuery, Boolean, ItemsCatalogQuery> update
    ) {
        return new CatalogFilterSpec.TriState<>(
                prompt, accessible, selected, update,
                query -> selected.apply(query) == null ? ""
                        : prompt + ": " + (selected.apply(query) ? "Ja" : "Nein"),
                query -> update.apply(query, null));
    }

    private static String joined(String first, String second) {
        if (first == null || first.isBlank()) {
            return shown(second);
        }
        return second == null || second.isBlank() ? first : first + " / " + second;
    }

    private static String shown(String value) {
        return value == null || value.isBlank() ? "–" : value;
    }
}
