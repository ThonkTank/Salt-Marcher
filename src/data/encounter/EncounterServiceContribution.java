package src.data.encounter;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encounter.repository.SqliteEncounterPlanRepository;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.party.PartyApplicationService;
import src.domain.sessionplanner.SessionPlannerApplicationService;

public final class EncounterServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        EncounterPlanRepository repository = new SqliteEncounterPlanRepository();
        builder.registerFactory(
                EncounterApplicationService.class,
                services -> new EncounterApplicationService(
                        services.require(PartyApplicationService.class),
                        services.require(CreaturesApplicationService.class),
                        services.require(EncounterTableApplicationService.class),
                        repository));
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                services -> new SessionPlannerApplicationService(
                        services.require(PartyApplicationService.class),
                        services.require(EncounterApplicationService.class)));
    }
}
