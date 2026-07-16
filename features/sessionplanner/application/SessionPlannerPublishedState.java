package features.sessionplanner.application;

import java.util.Objects;
import java.util.Optional;
import platform.ui.UiDispatcher;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.sessionplanner.api.SessionPlannerCatalogModel;
import features.sessionplanner.api.SessionPlannerCatalogSnapshot;
import features.sessionplanner.api.SessionPlannerCurrentSessionModel;
import features.sessionplanner.api.SessionPlannerParticipantsModel;
import features.sessionplanner.api.SessionPlannerParticipantsProjection;
import features.sessionplanner.api.SessionPlannerSceneTimelineModel;
import features.sessionplanner.api.SessionPlannerSceneTimelineProjection;
import features.sessionplanner.api.SessionPlannerSessionSnapshot;
import features.sessionplanner.api.SessionPlannerStatePanelModel;
import features.sessionplanner.api.SessionPlannerStatePanelProjection;
import platform.state.PublishedState;

public final class SessionPlannerPublishedState {

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

    public SessionPlannerPublishedState(
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

    public SessionPlannerCurrentSessionModel currentSessionModel() {
        return currentSessionModel;
    }

    public SessionPlannerCatalogModel catalogModel() {
        return catalogModel;
    }

    public SessionPlannerParticipantsModel participantsModel() {
        return participantsModel;
    }

    public SessionPlannerSceneTimelineModel sceneTimelineModel() {
        return sceneTimelineModel;
    }

    public SessionPlannerStatePanelModel statePanelModel() {
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

    Optional<SessionPlan> initialize() {
        if (loaded) {
            return Optional.empty();
        }
        Optional<SessionPlan> currentSession = repository.loadCurrent();
        if (currentSession.isEmpty()) {
            publishCatalog(NO_SESSION_ID, "");
            loaded = true;
            return Optional.empty();
        }
        publishCurrentSession(currentSession.get());
        return currentSession;
    }

    private void publishCatalog(long selectedSessionId, String statusText) {
        catalog.publish(projection.catalog(repository.listSessions(), selectedSessionId, statusText));
    }
}
