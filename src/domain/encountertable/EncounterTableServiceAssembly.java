package src.domain.encountertable;

import java.util.Objects;
import shell.api.ServiceRegistry;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableCandidatesModel;

final class EncounterTableServiceAssembly {

    private static final String REGISTRY_PARAMETER = "registry";

    EncounterTableApplicationService createApplicationService(ServiceRegistry services) {
        ServiceRegistry registry = Objects.requireNonNull(services, REGISTRY_PARAMETER);
        return new EncounterTableApplicationService(
                registry.require(EncounterTableCatalogPort.class),
                registry.require(EncounterTableCatalogModel.class),
                registry.require(EncounterTableCandidatesModel.class));
    }

    EncounterTableCatalogModel catalogModel(ServiceRegistry services) {
        Objects.requireNonNull(services, REGISTRY_PARAMETER);
        return new EncounterTableCatalogModel();
    }

    EncounterTableCandidatesModel candidatesModel(ServiceRegistry services) {
        Objects.requireNonNull(services, REGISTRY_PARAMETER);
        return new EncounterTableCandidatesModel();
    }
}
