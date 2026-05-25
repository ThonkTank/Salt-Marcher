package src.domain.creatures;

import java.util.Objects;
import shell.api.ServiceRegistry;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.model.catalog.usecase.LoadCreatureDetailUseCase;
import src.domain.creatures.model.catalog.usecase.LoadCreatureEncounterCandidatesUseCase;
import src.domain.creatures.model.catalog.usecase.LoadCreatureFilterOptionsUseCase;
import src.domain.creatures.model.catalog.usecase.SearchCreatureCatalogUseCase;

final class CreaturesServiceAssembly {

    private static final String REGISTRY_PARAMETER = "registry";

    private final CreaturesPublishedStateServiceAssembly publishedState =
            new CreaturesPublishedStateServiceAssembly();

    CreaturesApplicationService createApplicationService(ServiceRegistry registry) {
        ServiceRegistry services = Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        CreatureCatalogPort lookup = services.require(CreatureCatalogPort.class);
        return new CreaturesApplicationService(
                new LoadCreatureFilterOptionsUseCase(lookup, publishedState),
                new SearchCreatureCatalogUseCase(lookup, publishedState),
                new LoadCreatureDetailUseCase(lookup, publishedState),
                new LoadCreatureEncounterCandidatesUseCase(lookup, publishedState));
    }

    src.domain.creatures.published.CreatureFilterOptionsModel createFilterOptionsModel(
            ServiceRegistry registry
    ) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return publishedState.filterOptionsModel();
    }

    src.domain.creatures.published.CreatureCatalogModel createCatalogModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return publishedState.catalogModel();
    }

    src.domain.creatures.published.CreatureDetailModel createDetailModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return publishedState.detailModel();
    }

    src.domain.creatures.published.CreatureEncounterCandidatesModel createEncounterCandidatesModel(
            ServiceRegistry registry
    ) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return publishedState.encounterCandidatesModel();
    }

}
