package features.catalog.application;

import features.creatures.api.CreatureFilterOptions;
import java.util.List;
import java.util.Objects;

/** Typed Monster draft plus lazily resolved provider-supplied choices. */
public record MonsterCatalogQuery(
        MonsterCatalogFilterDraft filters,
        CreatureFilterOptions options,
        boolean filterOptionsResolved,
        List<CatalogReferenceOption> encounterTables,
        List<CatalogReferenceOption> factions,
        List<CatalogReferenceOption> locations
) {
    public MonsterCatalogQuery {
        filters = Objects.requireNonNull(filters, "filters");
        options = Objects.requireNonNull(options, "options");
        encounterTables = List.copyOf(Objects.requireNonNull(encounterTables, "encounterTables"));
        factions = List.copyOf(Objects.requireNonNull(factions, "factions"));
        locations = List.copyOf(Objects.requireNonNull(locations, "locations"));
    }

    public static MonsterCatalogQuery initial() {
        return new MonsterCatalogQuery(
                MonsterCatalogFilterDraft.empty(), CreatureFilterOptions.empty(), false,
                List.of(), List.of(), List.of());
    }

    public MonsterCatalogQuery withFilters(MonsterCatalogFilterDraft next) {
        return new MonsterCatalogQuery(next, options, filterOptionsResolved, encounterTables, factions, locations);
    }

    public MonsterCatalogQuery withOptions(CreatureFilterOptions next) {
        return new MonsterCatalogQuery(filters, next, true, encounterTables, factions, locations);
    }

    public MonsterCatalogQuery withReferenceOptions(
            List<CatalogReferenceOption> tables,
            List<CatalogReferenceOption> factionOptions,
            List<CatalogReferenceOption> locationOptions
    ) {
        return new MonsterCatalogQuery(
                filters, options, filterOptionsResolved, tables, factionOptions, locationOptions);
    }
}
