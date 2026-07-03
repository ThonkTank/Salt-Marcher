package src.domain.sessionplanner;

import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCatalogSnapshot;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;

final class SessionPlannerPublishedModelsServiceAssembly {

    private final Runnable loadPublishedState;
    private final SessionPlannerPublishedModelChannelServiceAssembly<SessionPlannerSessionSnapshot> sessions =
            new SessionPlannerPublishedModelChannelServiceAssembly<>(
                    SessionPlannerSessionSnapshot.empty("Session ist noch nicht geladen."));
    private final SessionPlannerPublishedModelChannelServiceAssembly<SessionPlannerCatalogSnapshot> catalog =
            new SessionPlannerPublishedModelChannelServiceAssembly<>(SessionPlannerCatalogSnapshot.empty());
    private final SessionPlannerPublishedModelChannelServiceAssembly<SessionPlannerParticipantsProjection>
            participants = new SessionPlannerPublishedModelChannelServiceAssembly<>(
                    SessionPlannerParticipantsProjection.empty());
    private final SessionPlannerPublishedModelChannelServiceAssembly<SessionPlannerSceneTimelineProjection>
            sceneTimeline = new SessionPlannerPublishedModelChannelServiceAssembly<>(
                    SessionPlannerSceneTimelineProjection.empty());
    private final SessionPlannerPublishedModelChannelServiceAssembly<SessionPlannerStatePanelProjection>
            statePanel = new SessionPlannerPublishedModelChannelServiceAssembly<>(
                    SessionPlannerStatePanelProjection.empty());
    private final SessionPlannerCurrentSessionModel currentSessionModel;
    private final SessionPlannerCatalogModel catalogModel;
    private final SessionPlannerParticipantsModel participantsModel;
    private final SessionPlannerSceneTimelineModel sceneTimelineModel;
    private final SessionPlannerStatePanelModel statePanelModel;

    SessionPlannerPublishedModelsServiceAssembly(Runnable loadPublishedState) {
        this.loadPublishedState = loadPublishedState;
        this.currentSessionModel = new SessionPlannerCurrentSessionModel(
                () -> {
                    loadPublishedState.run();
                    return sessions.current();
                },
                sessions::subscribe);
        this.catalogModel = new SessionPlannerCatalogModel(
                () -> {
                    loadPublishedState.run();
                    return catalog.current();
                },
                catalog::subscribe);
        this.participantsModel = new SessionPlannerParticipantsModel(
                () -> {
                    loadPublishedState.run();
                    return participants.current();
                },
                participants::subscribe);
        this.sceneTimelineModel = new SessionPlannerSceneTimelineModel(
                () -> {
                    loadPublishedState.run();
                    return sceneTimeline.current();
                },
                sceneTimeline::subscribe);
        this.statePanelModel = new SessionPlannerStatePanelModel(
                () -> {
                    loadPublishedState.run();
                    return statePanel.current();
                },
                statePanel::subscribe);
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

    void publishSession(SessionPlannerSessionSnapshot snapshot) {
        sessions.publish(snapshot);
    }

    void publishCatalog(SessionPlannerCatalogSnapshot snapshot) {
        catalog.publish(snapshot);
    }

    void publishParticipants(SessionPlannerParticipantsProjection projection) {
        participants.publish(projection);
    }

    void publishSceneTimeline(SessionPlannerSceneTimelineProjection projection) {
        sceneTimeline.publish(projection);
    }

    void publishStatePanel(SessionPlannerStatePanelProjection projection) {
        statePanel.publish(projection);
    }
}
