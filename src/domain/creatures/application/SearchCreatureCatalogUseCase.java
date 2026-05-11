package src.domain.creatures.application;

import src.domain.creatures.model.catalog.model.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;

import java.util.Objects;

public final class SearchCreatureCatalogUseCase {

    private final CreatureCatalogPort lookup;

    public SearchCreatureCatalogUseCase(CreatureCatalogPort lookup) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
    }

    public CreatureCatalogData.CatalogPageData execute(CreatureCatalogData.CatalogSearchSpec query) {
        return lookup.searchCatalog(Objects.requireNonNull(query, "query"));
    }
}
