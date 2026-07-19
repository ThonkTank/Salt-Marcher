package features.catalog.application;

import features.creatures.api.CreatureFilterOptions;
import java.util.List;
import java.util.Objects;

/** Typed Monster draft plus provider-supplied choices and sort. */
public record MonsterCatalogQuery(
        MonsterCatalogFilterDraft filters,
        CreatureFilterOptions options,
        MonsterCatalogSort sort,
        List<CatalogReferenceOption> encounterTables,
        List<CatalogReferenceOption> factions,
        List<CatalogReferenceOption> locations
) {
    public MonsterCatalogQuery {
        filters = Objects.requireNonNull(filters, "filters");
        options = Objects.requireNonNull(options, "options");
        sort = Objects.requireNonNull(sort, "sort");
        encounterTables = List.copyOf(Objects.requireNonNull(encounterTables, "encounterTables"));
        factions = List.copyOf(Objects.requireNonNull(factions, "factions"));
        locations = List.copyOf(Objects.requireNonNull(locations, "locations"));
    }

    public static MonsterCatalogQuery initial() {
        return new MonsterCatalogQuery(
                MonsterCatalogFilterDraft.empty(), CreatureFilterOptions.empty(), MonsterCatalogSort.NAME_ASC,
                List.of(), List.of(), List.of());
    }

    public MonsterCatalogQuery withFilters(MonsterCatalogFilterDraft next) {
        return new MonsterCatalogQuery(next, options, sort, encounterTables, factions, locations);
    }

    public MonsterCatalogQuery withOptions(CreatureFilterOptions next) {
        return new MonsterCatalogQuery(filters, next, sort, encounterTables, factions, locations);
    }

    public MonsterCatalogQuery withSort(MonsterCatalogSort next) {
        return new MonsterCatalogQuery(filters, options, next, encounterTables, factions, locations);
    }

    public MonsterCatalogQuery withReferenceOptions(
            List<CatalogReferenceOption> tables,
            List<CatalogReferenceOption> factionOptions,
            List<CatalogReferenceOption> locationOptions
    ) {
        return new MonsterCatalogQuery(filters, options, sort, tables, factionOptions, locationOptions);
    }
}
