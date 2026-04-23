package src.data.encounter;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encounter.repository.SqliteEncounterPlanRepository;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.plan.port.EncounterPlanRepository;

public final class EncounterServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        EncounterPlanRepository repository = new SqliteEncounterPlanRepository();
        builder.register(
                EncounterApplicationService.class,
                new EncounterApplicationService(repository));
    }
}
