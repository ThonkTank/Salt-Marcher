package src.domain.creatures.application;

import src.domain.creatures.model.catalog.repository.CreatureCatalogRepository;

import java.util.Objects;

public final class SearchCreatureCatalogUseCase {

    private final CreatureCatalogRepository lookup;

    public SearchCreatureCatalogUseCase(CreatureCatalogRepository lookup) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
    }

    public CreatureCatalogRepository.CatalogPageData execute(CreatureCatalogRepository.CatalogSearchSpec query) {
        return lookup.searchCatalog(Objects.requireNonNull(query, "query"));
    }
}
