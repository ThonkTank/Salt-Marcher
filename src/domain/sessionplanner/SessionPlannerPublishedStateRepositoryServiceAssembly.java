package src.domain.sessionplanner;

import java.util.Objects;
import java.util.Optional;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionPlanSummary;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.port.SessionLocationReferencePort;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCatalogSnapshot;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

final class SessionPlannerPublishedStateRepositoryServiceAssembly
        implements SessionPlannerPublishedStateRepository {

    private static final long NO_SESSION_ID = 0L;

    private final SessionPlanRepository repository;
    private final SessionPartyFactsPort partyFactsPort;
    private final SessionPartyFactsRepository partyFactsRepository;
    private final SessionEncounterFactsPort encounterFactsPort;
    private final SessionEncounterFactsRepository encounterFactsRepository;
    private final SessionLocationReferencePort locationReferences;
    private final SessionPlannerPublishedModelsServiceAssembly publishedModels =
            new SessionPlannerPublishedModelsServiceAssembly(this::loadPublishedState);
    private boolean loaded;

    SessionPlannerPublishedStateRepositoryServiceAssembly(
            SessionPlanRepository repository,
            SessionPartyFactsPort partyFacts,
            SessionPartyFactsRepository partyFactsRepository,
            SessionEncounterFactsPort encounterFacts,
            SessionEncounterFactsRepository encounterFactsRepository,
            SessionLocationReferencePort locationReferences
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.partyFactsPort = Objects.requireNonNull(partyFacts, "partyFacts");
        this.partyFactsRepository = Objects.requireNonNull(partyFactsRepository, "partyFactsRepository");
        this.encounterFactsPort = Objects.requireNonNull(encounterFacts, "encounterFacts");
        this.encounterFactsRepository = Objects.requireNonNull(encounterFactsRepository, "encounterFactsRepository");
        this.locationReferences = Objects.requireNonNull(locationReferences, "locationReferences");
    }

    @Override
    public void publishCurrentSession(SessionPlan sessionPlan) {
        SessionPlan safeSession = Objects.requireNonNull(sessionPlan, "sessionPlan");
        publishCatalog(safeSession.sessionId(), safeSession.statusText());
        publishedModels.publishSession(SessionPlannerSessionProjectionServiceAssembly.projectSession(
                safeSession,
                partyFactsPort,
                partyFactsRepository,
                encounterFactsPort,
                encounterFactsRepository,
                locationReferences));
        publishedModels.publishParticipants(SessionPlannerParticipantsProjectionServiceAssembly.projectParticipants(
                safeSession,
                partyFactsPort));
        publishedModels.publishSceneTimeline(SessionPlannerSceneTimelineProjectionServiceAssembly.projectSceneTimeline(
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
        loaded = true;
    }

    SessionPlannerCurrentSessionModel currentSessionModel() {
        return publishedModels.currentSessionModel();
    }

    SessionPlannerCatalogModel catalogModel() {
        return publishedModels.catalogModel();
    }

    SessionPlannerParticipantsModel participantsModel() {
        return publishedModels.participantsModel();
    }

    SessionPlannerSceneTimelineModel sceneTimelineModel() {
        return publishedModels.sceneTimelineModel();
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
            publishCatalog(NO_SESSION_ID, "");
            loaded = true;
            return;
        }
        publishCurrentSession(currentSession.get());
    }

    void publishLoadedCurrentSession() {
        if (!loaded) {
            return;
        }
        Optional<SessionPlan> currentSession = repository.loadCurrent();
        if (currentSession.isPresent()) {
            publishCurrentSession(currentSession.get());
        }
    }

    private void publishCatalog(long selectedSessionId, String statusText) {
        publishedModels.publishCatalog(new SessionPlannerCatalogSnapshot(
                repository.listSessions().stream()
                        .map(this::catalogSummary)
                        .toList(),
                selectedSessionId,
                statusText));
    }

    private SessionPlannerCatalogSnapshot.SessionSummary catalogSummary(SessionPlanSummary summary) {
        return new SessionPlannerCatalogSnapshot.SessionSummary(summary.sessionId(), summary.displayName());
    }
}
