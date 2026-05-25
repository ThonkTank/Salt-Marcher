package src.domain.encountertable;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableCandidatesModel;

public final class EncounterTableServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder services) {
        EncounterTableServiceAssembly assembly = new EncounterTableServiceAssembly();
        services.registerFactory(EncounterTableApplicationService.class, assembly::createApplicationService);
        services.registerFactory(EncounterTableCatalogModel.class, assembly::catalogModel);
        services.registerFactory(EncounterTableCandidatesModel.class, assembly::candidatesModel);
    }
}
