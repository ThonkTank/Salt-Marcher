package src.data.sessionplanner;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.ApplicationSessionPlannerFactsQueryAdapter;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
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
        SessionPlanRepository repository = new SqliteSessionPlanRepository();
        AssemblyFactory assemblies = new AssemblyFactory(repository);
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                services -> assemblies.resolve(services).applicationService);
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                services -> assemblies.resolve(services).currentSessionModel);
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                services -> assemblies.resolve(services).participantsModel);
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                services -> assemblies.resolve(services).encountersModel);
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                services -> assemblies.resolve(services).statePanelModel);
    }

    private static final class AssemblyFactory {

        private final SessionPlanRepository repository;
        private ResolvedAssembly resolved;

        private AssemblyFactory(SessionPlanRepository repository) {
            this.repository = repository;
        }

        private ResolvedAssembly resolve(ServiceRegistry services) {
            if (resolved == null) {
                resolved = new ResolvedAssembly(repository, services);
            }
            return resolved;
        }
    }

    private static final class ResolvedAssembly {

        private final SessionPlannerApplicationService applicationService;
        private final SessionPlannerCurrentSessionModel currentSessionModel;
        private final SessionPlannerParticipantsModel participantsModel;
        private final SessionPlannerEncountersModel encountersModel;
        private final SessionPlannerStatePanelModel statePanelModel;

        private ResolvedAssembly(SessionPlanRepository repository, ServiceRegistry services) {
            ApplicationSessionPlannerFactsQueryAdapter facts = new ApplicationSessionPlannerFactsQueryAdapter(
                    services.require(PartyApplicationService.class),
                    services.require(ActivePartyModel.class),
                    services.require(AdventuringDayCalculationModel.class),
                    services.require(EncounterApplicationService.class),
                    services.require(SavedEncounterPlanListModel.class),
                    services.require(EncounterPlanBudgetModel.class));
            SessionPlannerPublishedStateRepositoryAdapter publishedState =
                    new SessionPlannerPublishedStateRepositoryAdapter(repository, facts, facts);
            this.applicationService = new SessionPlannerApplicationService(repository, facts, facts, publishedState);
            this.currentSessionModel = publishedState.currentSessionModel;
            this.participantsModel = publishedState.participantsModel;
            this.encountersModel = publishedState.encountersModel;
            this.statePanelModel = publishedState.statePanelModel;
        }
    }
}
