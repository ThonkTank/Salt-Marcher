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
        PlannerRuntimeHolder runtimeHolder = new PlannerRuntimeHolder();
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                services -> runtimeHolder.resolve(services).applicationService());
        builder.registerFactory(
                SessionPlannerModel.class,
                services -> runtimeHolder.resolve(services).sessionModel());
    }

    private static final class PlannerRuntimeHolder {

        private PlannerRuntimeServices runtimeServices;

        private PlannerRuntimeServices resolve(ServiceRegistry services) {
            if (runtimeServices == null) {
                SessionPlanRepository repository = new SqliteSessionPlanRepository();
                ApplicationSessionPlannerFactsQueryAdapter facts = new ApplicationSessionPlannerFactsQueryAdapter(
                        services.require(PartyApplicationService.class),
                        services.require(ActivePartyModel.class),
                        services.require(AdventuringDayCalculationModel.class),
                        services.require(EncounterApplicationService.class));
                SessionPlannerBoundaryRuntimeAdapter runtime =
                        new SessionPlannerBoundaryRuntimeAdapter(repository, facts, facts);
                runtimeServices = new PlannerRuntimeServices(
                        new SessionPlannerApplicationService(runtime, runtime, runtime, runtime),
                        runtime.sessionModel());
            }
            return runtimeServices;
        }
    }

    private record PlannerRuntimeServices(
            SessionPlannerApplicationService applicationService,
            SessionPlannerModel sessionModel
    ) {
    }
}
