package src.data.sessionplanner;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.ApplicationSessionPlannerFactsQueryAdapter;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
import src.domain.encounter.EncounterApplicationService;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.session.port.SessionPlanRepository;

public final class SessionPlannerServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public SessionPlannerServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                services -> {
                    SessionPlanRepository repository = new SqliteSessionPlanRepository();
                    ApplicationSessionPlannerFactsQueryAdapter facts = new ApplicationSessionPlannerFactsQueryAdapter(
                            services.require(PartyApplicationService.class),
                            services.require(ActivePartyModel.class),
                            services.require(AdventuringDayCalculationModel.class),
                            services.require(EncounterApplicationService.class));
                    return new SessionPlannerApplicationService(repository, facts, facts);
                });
    }
}
