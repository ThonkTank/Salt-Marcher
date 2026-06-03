package src.domain.sessionplanner;

import java.util.Objects;
import java.util.Optional;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

final class SessionPlannerPublishedStateRepositoryServiceAssembly
        implements SessionPlannerPublishedStateRepository {

    private final SessionPlanRepository repository;
    private final SessionPartyFactsPort partyFactsPort;
    private final SessionPartyFactsRepository partyFactsRepository;
    private final SessionEncounterFactsPort encounterFactsPort;
    private final SessionEncounterFactsRepository encounterFactsRepository;
    private final SessionPlannerPublishedModelsServiceAssembly publishedModels =
            new SessionPlannerPublishedModelsServiceAssembly(this::loadPublishedState);
    private boolean loaded;

    SessionPlannerPublishedStateRepositoryServiceAssembly(
            SessionPlanRepository repository,
            SessionPartyFactsPort partyFacts,
            SessionPartyFactsRepository partyFactsRepository,
            SessionEncounterFactsPort encounterFacts,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.partyFactsPort = Objects.requireNonNull(partyFacts, "partyFacts");
        this.partyFactsRepository = Objects.requireNonNull(partyFactsRepository, "partyFactsRepository");
        this.encounterFactsPort = Objects.requireNonNull(encounterFacts, "encounterFacts");
        this.encounterFactsRepository = Objects.requireNonNull(encounterFactsRepository, "encounterFactsRepository");
    }

    @Override
    public void publishCurrentSession(SessionPlan sessionPlan) {
        SessionPlan safeSession = Objects.requireNonNull(sessionPlan, "sessionPlan");
        publishSessionAndParticipants(safeSession);
        publishEncountersAndStatePanel(safeSession);
        loaded = true;
    }

    void publishSessionAndParticipants(SessionPlan safeSession) {
        publishedModels.publishSession(SessionPlannerSessionProjectionServiceAssembly.projectSession(
                safeSession,
                partyFactsPort,
                partyFactsRepository,
                encounterFactsPort,
                encounterFactsRepository));
        publishedModels.publishParticipants(SessionPlannerParticipantsProjectionServiceAssembly.projectParticipants(
                safeSession,
                partyFactsPort));
    }

    void publishEncountersAndStatePanel(SessionPlan safeSession) {
        publishedModels.publishEncounters(SessionPlannerEncountersProjectionServiceAssembly.projectEncounters(
                safeSession,
                partyFactsPort,
                partyFactsRepository,
                encounterFactsRepository));
        publishedModels.publishStatePanel(SessionPlannerStatePanelProjectionServiceAssembly.projectStatePanel(
                safeSession,
                partyFactsPort,
                partyFactsRepository,
                encounterFactsPort,
                encounterFactsRepository));
    }

    SessionPlannerCurrentSessionModel currentSessionModel() {
        return publishedModels.currentSessionModel();
    }

    SessionPlannerParticipantsModel participantsModel() {
        return publishedModels.participantsModel();
    }

    SessionPlannerEncountersModel encountersModel() {
        return publishedModels.encountersModel();
    }

    SessionPlannerStatePanelModel statePanelModel() {
        return publishedModels.statePanelModel();
    }

    private void loadPublishedState() {
        if (loaded) {
            return;
        }
        Optional<SessionPlan> currentSession = repository.loadCurrent();
        if (currentSession.isEmpty()) {
            loaded = true;
            return;
        }
        publishCurrentSession(currentSession.get());
    }
}
