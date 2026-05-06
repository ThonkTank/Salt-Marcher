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
import src.domain.sessionplanner.application.SessionPlannerBoundaryRuntimeAdapter;
import src.domain.sessionplanner.published.SessionPlannerModel;
import src.domain.sessionplanner.session.port.SessionPlanRepository;

public final class SessionPlannerServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public SessionPlannerServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        SessionPlannerApplicationService[] applicationServiceRef = new SessionPlannerApplicationService[1];
        SessionPlannerModel[] sessionModelRef = new SessionPlannerModel[1];
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                services -> {
                    if (applicationServiceRef[0] == null) {
                        SessionPlanRepository repository = new SqliteSessionPlanRepository();
                        ApplicationSessionPlannerFactsQueryAdapter facts = new ApplicationSessionPlannerFactsQueryAdapter(
                                services.require(PartyApplicationService.class),
                                services.require(ActivePartyModel.class),
                                services.require(AdventuringDayCalculationModel.class),
                                services.require(EncounterApplicationService.class));
                        SessionPlannerBoundaryRuntimeAdapter runtime =
                                new SessionPlannerBoundaryRuntimeAdapter(repository, facts, facts);
                        applicationServiceRef[0] = new SessionPlannerApplicationService(runtime, runtime, runtime, runtime);
                        sessionModelRef[0] = runtime.sessionModel;
                    }
                    return applicationServiceRef[0];
                });
        builder.registerFactory(
                SessionPlannerModel.class,
                services -> {
                    if (sessionModelRef[0] == null) {
                        SessionPlanRepository repository = new SqliteSessionPlanRepository();
                        ApplicationSessionPlannerFactsQueryAdapter facts = new ApplicationSessionPlannerFactsQueryAdapter(
                                services.require(PartyApplicationService.class),
                                services.require(ActivePartyModel.class),
                                services.require(AdventuringDayCalculationModel.class),
                                services.require(EncounterApplicationService.class));
                        SessionPlannerBoundaryRuntimeAdapter runtime =
                                new SessionPlannerBoundaryRuntimeAdapter(repository, facts, facts);
                        applicationServiceRef[0] = new SessionPlannerApplicationService(runtime, runtime, runtime, runtime);
                        sessionModelRef[0] = runtime.sessionModel;
                    }
                    return sessionModelRef[0];
                });
    }
}
