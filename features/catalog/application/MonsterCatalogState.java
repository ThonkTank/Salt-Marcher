package features.catalog.application;

import features.creatures.api.CreatureCatalogQuery;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureFilterOptions;
import java.util.Objects;

/** The single immutable Monster truth rendered by the Catalog workspace. */
public record MonsterCatalogState(
        long revision,
        long lifecycleRevision,
        long requestRevision,
        Lifecycle lifecycle,
        MonsterCatalogFilterDraft filterDraft,
        CreatureFilterOptions filterOptions,
        MonsterCatalogSort sort,
        int pageSize,
        int pageOffset,
        int totalCount,
        long selectedCreatureId,
        CatalogResultState<CreatureCatalogRow> results
) {

    public MonsterCatalogState {
        revision = Math.max(0L, revision);
        lifecycleRevision = Math.max(0L, lifecycleRevision);
        requestRevision = Math.max(0L, requestRevision);
        lifecycle = Objects.requireNonNull(lifecycle, "lifecycle");
        filterDraft = Objects.requireNonNull(filterDraft, "filterDraft");
        filterOptions = Objects.requireNonNull(filterOptions, "filterOptions");
        sort = Objects.requireNonNull(sort, "sort");
        pageSize = Math.max(1, pageSize);
        pageOffset = Math.max(0, pageOffset);
        totalCount = Math.max(0, totalCount);
        selectedCreatureId = Math.max(0L, selectedCreatureId);
        results = Objects.requireNonNull(results, "results");
    }

    static MonsterCatalogState initial() {
        return new MonsterCatalogState(
                0L, 0L, 0L, Lifecycle.INACTIVE,
                MonsterCatalogFilterDraft.empty(), CreatureFilterOptions.empty(), MonsterCatalogSort.NAME_ASC,
                50, 0, 0, 0L, CatalogResultState.loading());
    }

    public CreatureCatalogQuery query() {
        return new CreatureCatalogQuery(
                filterDraft.nameQuery(), filterDraft.challengeRatingMin(), filterDraft.challengeRatingMax(),
                filterDraft.sizes(), filterDraft.creatureTypes(), filterDraft.creatureSubtypes(),
                filterDraft.biomes(), filterDraft.alignments(), sort.providerField(), sort.providerDirection(),
                pageSize, pageOffset);
    }

    public enum Lifecycle {
        INACTIVE,
        ACTIVE,
        CLOSED
    }
}
