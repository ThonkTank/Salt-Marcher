package src.data.sessionplanner;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.ApplicationSessionPlannerFactsQueryAdapter;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
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
                services -> assemblies.applicationService(services));
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                services -> assemblies.currentSessionModel(services));
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                services -> assemblies.participantsModel(services));
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                services -> assemblies.encountersModel(services));
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                services -> assemblies.statePanelModel(services));
    }

    private static final class AssemblyFactory {

        private final SessionPlanRepository repository;
        private ResolvedAssembly resolved;

        private AssemblyFactory(SessionPlanRepository repository) {
            this.repository = repository;
        }

        private SessionPlannerApplicationService applicationService(ServiceRegistry services) {
            return resolve(services).applicationService();
        }

        private SessionPlannerCurrentSessionModel currentSessionModel(ServiceRegistry services) {
            return resolve(services).currentSessionModel();
        }

        private SessionPlannerParticipantsModel participantsModel(ServiceRegistry services) {
            return resolve(services).participantsModel();
        }

        private SessionPlannerEncountersModel encountersModel(ServiceRegistry services) {
            return resolve(services).encountersModel();
        }

        private SessionPlannerStatePanelModel statePanelModel(ServiceRegistry services) {
            return resolve(services).statePanelModel();
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
        private final SessionPlannerPublishedStateRepositoryAdapter publishedState;

        private ResolvedAssembly(SessionPlanRepository repository, ServiceRegistry services) {
            ApplicationSessionPlannerFactsQueryAdapter facts = ApplicationSessionPlannerFactsQueryAdapter.create(services);
            this.publishedState = new SessionPlannerPublishedStateRepositoryAdapter(repository, facts, facts);
            this.applicationService = new SessionPlannerApplicationService(repository, facts, publishedState);
        }

        private SessionPlannerApplicationService applicationService() {
            return applicationService;
        }

        private SessionPlannerCurrentSessionModel currentSessionModel() {
            return publishedState.currentSessionModel();
        }

        private SessionPlannerParticipantsModel participantsModel() {
            return publishedState.participantsModel();
        }

        private SessionPlannerEncountersModel encountersModel() {
            return publishedState.encountersModel();
        }

        private SessionPlannerStatePanelModel statePanelModel() {
            return publishedState.statePanelModel();
        }
    }
}
