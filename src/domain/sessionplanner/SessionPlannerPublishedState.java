package src.domain.sessionplanner;

import java.util.Objects;
import java.util.Optional;
import platform.ui.UiDispatcher;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCatalogSnapshot;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;
import src.domain.shared.published.PublishedState;

final class SessionPlannerPublishedState {

    private static final long NO_SESSION_ID = 0L;

    private final SessionPlanRepository repository;
    private final SessionPlannerForeignFacts facts;
    private final SessionPlannerProjection projection;
    private final PublishedState<SessionPlannerSessionSnapshot> sessions;
    private final PublishedState<SessionPlannerCatalogSnapshot> catalog;
    private final PublishedState<SessionPlannerParticipantsProjection> participants;
    private final PublishedState<SessionPlannerSceneTimelineProjection> sceneTimeline;
    private final PublishedState<SessionPlannerStatePanelProjection> statePanel;
    private final SessionPlannerCurrentSessionModel currentSessionModel;
    private final SessionPlannerCatalogModel catalogModel;
    private final SessionPlannerParticipantsModel participantsModel;
    private final SessionPlannerSceneTimelineModel sceneTimelineModel;
    private final SessionPlannerStatePanelModel statePanelModel;
    private boolean loaded;

    SessionPlannerPublishedState(
            SessionPlanRepository repository,
            SessionPlannerForeignFacts facts,
            SessionPlannerProjection projection,
            UiDispatcher dispatcher
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.facts = Objects.requireNonNull(facts, "facts");
        this.projection = Objects.requireNonNull(projection, "projection");
        UiDispatcher uiDispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        sessions = new PublishedState<>(
                SessionPlannerSessionSnapshot.empty("Session ist noch nicht geladen."), uiDispatcher);
        catalog = new PublishedState<>(SessionPlannerCatalogSnapshot.empty(), uiDispatcher);
        participants = new PublishedState<>(SessionPlannerParticipantsProjection.empty(), uiDispatcher);
        sceneTimeline = new PublishedState<>(SessionPlannerSceneTimelineProjection.empty(), uiDispatcher);
        statePanel = new PublishedState<>(SessionPlannerStatePanelProjection.empty(), uiDispatcher);
        currentSessionModel = new SessionPlannerCurrentSessionModel(sessions::current, sessions::subscribe);
        catalogModel = new SessionPlannerCatalogModel(catalog::current, catalog::subscribe);
        participantsModel = new SessionPlannerParticipantsModel(participants::current, participants::subscribe);
        sceneTimelineModel = new SessionPlannerSceneTimelineModel(sceneTimeline::current, sceneTimeline::subscribe);
        statePanelModel = new SessionPlannerStatePanelModel(statePanel::current, statePanel::subscribe);
    }

    SessionPlannerCurrentSessionModel currentSessionModel() {
        return currentSessionModel;
    }

    SessionPlannerCatalogModel catalogModel() {
        return catalogModel;
    }

    SessionPlannerParticipantsModel participantsModel() {
        return participantsModel;
    }

    SessionPlannerSceneTimelineModel sceneTimelineModel() {
        return sceneTimelineModel;
    }

    SessionPlannerStatePanelModel statePanelModel() {
        return statePanelModel;
    }

    void publishCurrentSession(SessionPlan sessionPlan) {
        SessionPlan safeSession = Objects.requireNonNull(sessionPlan, "sessionPlan");
        publishCatalog(safeSession.sessionId(), safeSession.statusText());
        publishSessionProjections(safeSession);
    }

    void publishCurrentSessionWithoutCatalogRefresh(SessionPlan sessionPlan) {
        publishSessionProjections(Objects.requireNonNull(sessionPlan, "sessionPlan"));
    }

    private void publishSessionProjections(SessionPlan safeSession) {
        sessions.publish(projection.session(safeSession, facts));
        participants.publish(projection.participants(safeSession, facts));
        sceneTimeline.publish(projection.sceneTimeline(safeSession, facts));
        statePanel.publish(projection.statePanel(safeSession, facts));
        loaded = true;
    }

    void publishLoadedCurrentSession() {
        if (!loaded) {
            return;
        }
        Optional<SessionPlan> currentSession = repository.loadCurrent();
        currentSession.ifPresent(this::publishCurrentSession);
    }

    void initialize() {
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

    private void publishCatalog(long selectedSessionId, String statusText) {
        catalog.publish(projection.catalog(repository.listSessions(), selectedSessionId, statusText));
    }
}
