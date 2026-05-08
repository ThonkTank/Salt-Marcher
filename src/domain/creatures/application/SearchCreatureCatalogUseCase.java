package src.domain.creatures.application;

import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.util.Objects;
import src.domain.creatures.published.CreatureCatalogPage;

public final class SearchCreatureCatalogUseCase {

    private final CreatureCatalogLookup lookup;

    public SearchCreatureCatalogUseCase(CreatureCatalogLookup lookup) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
    }

    public CreatureCatalogPage execute(CreatureCatalogLookup.CatalogSearchSpec query) {
        return lookup.searchCatalog(Objects.requireNonNull(query, "query"));
    }
}
