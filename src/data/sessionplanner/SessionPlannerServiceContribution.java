package src.data.sessionplanner;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.ApplicationSessionPlannerFactsQueryAdapter;
import src.data.sessionplanner.query.SessionPlannerPublishedStateRuntime;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.session.port.SessionPlanRepository;

public final class SessionPlannerServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public SessionPlannerServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        SharedRuntime sharedRuntime = new SharedRuntime();
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                services -> sharedRuntime.resolve(services).applicationService());
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                services -> sharedRuntime.resolve(services).publishedStateRuntime().currentSessionModel());
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                services -> sharedRuntime.resolve(services).publishedStateRuntime().participantsModel());
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                services -> sharedRuntime.resolve(services).publishedStateRuntime().encountersModel());
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                services -> sharedRuntime.resolve(services).publishedStateRuntime().statePanelModel());
    }

    private static final class SharedRuntime {

        private RuntimeServices services;

        private RuntimeServices resolve(ServiceRegistry serviceRegistry) {
            if (services == null) {
                SessionPlanRepository repository = new SqliteSessionPlanRepository();
                ApplicationSessionPlannerFactsQueryAdapter facts = new ApplicationSessionPlannerFactsQueryAdapter(
                        serviceRegistry.require(PartyApplicationService.class),
                        serviceRegistry.require(ActivePartyModel.class),
                        serviceRegistry.require(AdventuringDayCalculationModel.class),
                        serviceRegistry.require(EncounterApplicationService.class),
                        serviceRegistry.require(SavedEncounterPlanListModel.class),
                        serviceRegistry.require(EncounterPlanBudgetModel.class));
                SessionPlannerPublishedStateRuntime publishedStateRuntime =
                        new SessionPlannerPublishedStateRuntime(repository, facts, facts);
                services = new RuntimeServices(
                        new SessionPlannerApplicationService(repository, facts, facts, publishedStateRuntime),
                        publishedStateRuntime);
            }
            return services;
        }
    }

    private record RuntimeServices(
            SessionPlannerApplicationService applicationService,
            SessionPlannerPublishedStateRuntime publishedStateRuntime
    ) {
    }
}
