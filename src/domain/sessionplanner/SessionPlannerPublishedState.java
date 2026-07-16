package src.domain.sessionplanner;

import java.util.Objects;
import java.util.Optional;
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
    private final PublishedState<SessionPlannerSessionSnapshot> sessions =
            new PublishedState<>(SessionPlannerSessionSnapshot.empty("Session ist noch nicht geladen."));
    private final PublishedState<SessionPlannerCatalogSnapshot> catalog =
            new PublishedState<>(SessionPlannerCatalogSnapshot.empty());
    private final PublishedState<SessionPlannerParticipantsProjection> participants =
            new PublishedState<>(SessionPlannerParticipantsProjection.empty());
    private final PublishedState<SessionPlannerSceneTimelineProjection> sceneTimeline =
            new PublishedState<>(SessionPlannerSceneTimelineProjection.empty());
    private final PublishedState<SessionPlannerStatePanelProjection> statePanel =
            new PublishedState<>(SessionPlannerStatePanelProjection.empty());
    private final SessionPlannerCurrentSessionModel currentSessionModel =
            new SessionPlannerCurrentSessionModel(this::currentSession, sessions::subscribe);
    private final SessionPlannerCatalogModel catalogModel =
            new SessionPlannerCatalogModel(this::currentCatalog, catalog::subscribe);
    private final SessionPlannerParticipantsModel participantsModel =
            new SessionPlannerParticipantsModel(this::currentParticipants, participants::subscribe);
    private final SessionPlannerSceneTimelineModel sceneTimelineModel =
            new SessionPlannerSceneTimelineModel(this::currentSceneTimeline, sceneTimeline::subscribe);
    private final SessionPlannerStatePanelModel statePanelModel =
            new SessionPlannerStatePanelModel(this::currentStatePanel, statePanel::subscribe);
    private boolean loaded;

    SessionPlannerPublishedState(
            SessionPlanRepository repository,
            SessionPlannerForeignFacts facts,
            SessionPlannerProjection projection
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.facts = Objects.requireNonNull(facts, "facts");
        this.projection = Objects.requireNonNull(projection, "projection");
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

    private SessionPlannerSessionSnapshot currentSession() {
        loadPublishedState();
        return sessions.current();
    }

    private SessionPlannerCatalogSnapshot currentCatalog() {
        loadPublishedState();
        return catalog.current();
    }

    private SessionPlannerParticipantsProjection currentParticipants() {
        loadPublishedState();
        return participants.current();
    }

    private SessionPlannerSceneTimelineProjection currentSceneTimeline() {
        loadPublishedState();
        return sceneTimeline.current();
    }

    private SessionPlannerStatePanelProjection currentStatePanel() {
        loadPublishedState();
        return statePanel.current();
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

    private void publishCatalog(long selectedSessionId, String statusText) {
        catalog.publish(projection.catalog(repository.listSessions(), selectedSessionId, statusText));
    }
}
