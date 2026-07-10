package src.domain.creatures;

import java.util.Objects;
import shell.api.ServiceRegistry;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.creatures.published.CreatureFilterOptionsModel;

final class CreaturesServiceAssembly {

    private static final String REGISTRY_PARAMETER = "registry";

    CreaturesApplicationService createApplicationService(ServiceRegistry registry) {
        ServiceRegistry services = Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return new CreaturesApplicationService(
                services.require(CreatureCatalogPort.class),
                services.require(CreatureFilterOptionsModel.class),
                services.require(CreatureCatalogModel.class),
                services.require(CreatureDetailModel.class),
                services.require(CreatureEncounterCandidatesModel.class));
    }

    CreatureFilterOptionsModel createFilterOptionsModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return new CreatureFilterOptionsModel();
    }

    CreatureCatalogModel createCatalogModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return new CreatureCatalogModel();
    }

    CreatureDetailModel createDetailModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return new CreatureDetailModel();
    }

    CreatureEncounterCandidatesModel createEncounterCandidatesModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, REGISTRY_PARAMETER);
        return new CreatureEncounterCandidatesModel();
    }

}
