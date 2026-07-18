package features.catalog.application;

import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureFilterOptions;
import features.encounter.api.EncounterBuilderInputs;
import java.util.Objects;

public record MonsterCatalogState(
        CatalogResultState<CreatureCatalogRow> results,
        CreatureFilterOptions filterOptions,
        EncounterBuilderInputs encounterPoolFilters,
        long selectedCreatureId,
        int pageOffset,
        String unfinishedInput
) {
    public MonsterCatalogState {
        results = Objects.requireNonNull(results, "results");
        filterOptions = Objects.requireNonNull(filterOptions, "filterOptions");
        encounterPoolFilters = Objects.requireNonNull(encounterPoolFilters, "encounterPoolFilters");
        selectedCreatureId = Math.max(0L, selectedCreatureId);
        pageOffset = Math.max(0, pageOffset);
        unfinishedInput = Objects.requireNonNull(unfinishedInput, "unfinishedInput");
    }

    static MonsterCatalogState initial() {
        return new MonsterCatalogState(
                CatalogResultState.loading(),
                CreatureFilterOptions.empty(),
                EncounterBuilderInputs.empty(),
                0L, 0, "");
    }
}
