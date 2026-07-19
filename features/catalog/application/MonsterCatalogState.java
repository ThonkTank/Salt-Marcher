package features.catalog.application;

import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureFilterOptions;
import java.util.List;
import java.util.Objects;

/** Temporary M3 presentation projection; browse truth lives in CatalogSectionState. */
public record MonsterCatalogState(
        long revision,
        MonsterCatalogFilterDraft filterDraft,
        CreatureFilterOptions filterOptions,
        MonsterCatalogSort sort,
        int pageSize,
        int pageOffset,
        int totalCount,
        long selectedCreatureId,
        CatalogResultState<CreatureCatalogRow> results,
        List<CatalogReferenceOption> encounterTableOptions,
        List<CatalogReferenceOption> factionOptions,
        List<CatalogReferenceOption> locationOptions
) {
    public MonsterCatalogState {
        revision = Math.max(0L, revision);
        filterDraft = Objects.requireNonNull(filterDraft, "filterDraft");
        filterOptions = Objects.requireNonNull(filterOptions, "filterOptions");
        sort = Objects.requireNonNull(sort, "sort");
        pageSize = Math.max(1, pageSize);
        pageOffset = Math.max(0, pageOffset);
        totalCount = Math.max(0, totalCount);
        selectedCreatureId = Math.max(0L, selectedCreatureId);
        results = Objects.requireNonNull(results, "results");
        encounterTableOptions = List.copyOf(encounterTableOptions);
        factionOptions = List.copyOf(factionOptions);
        locationOptions = List.copyOf(locationOptions);
    }

    static MonsterCatalogState initial() {
        return new MonsterCatalogState(
                0L, MonsterCatalogFilterDraft.empty(), CreatureFilterOptions.empty(),
                MonsterCatalogSort.NAME_ASC, 50, 0, 0, 0L, CatalogResultState.uninitialized(),
                List.of(), List.of(), List.of());
    }
}
