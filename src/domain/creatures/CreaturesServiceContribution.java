package src.domain.creatures;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;

public final class CreaturesServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder services) {
        CreaturesServiceAssembly assembly = new CreaturesServiceAssembly();
        services.registerFactory(CreaturesApplicationService.class, assembly::createApplicationService);
        services.registerFactory(
                src.domain.creatures.published.CreatureFilterOptionsModel.class,
                assembly::createFilterOptionsModel);
        services.registerFactory(
                src.domain.creatures.published.CreatureCatalogModel.class,
                assembly::createCatalogModel);
        services.registerFactory(
                src.domain.creatures.published.CreatureDetailModel.class,
                assembly::createDetailModel);
        services.registerFactory(
                src.domain.creatures.published.CreatureEncounterCandidatesModel.class,
                assembly::createEncounterCandidatesModel);
    }
}
