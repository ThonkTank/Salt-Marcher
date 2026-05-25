package src.domain.sessionplanner;

import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
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
    private final SessionPlannerPublishedModelChannelServiceAssembly<SessionPlannerParticipantsProjection>
            participants = new SessionPlannerPublishedModelChannelServiceAssembly<>(
                    SessionPlannerParticipantsProjection.empty());
    private final SessionPlannerPublishedModelChannelServiceAssembly<SessionPlannerEncountersProjection>
            encounters = new SessionPlannerPublishedModelChannelServiceAssembly<>(
                    SessionPlannerEncountersProjection.empty());
    private final SessionPlannerPublishedModelChannelServiceAssembly<SessionPlannerStatePanelProjection>
            statePanel = new SessionPlannerPublishedModelChannelServiceAssembly<>(
                    SessionPlannerStatePanelProjection.empty());
    private final SessionPlannerCurrentSessionModel currentSessionModel;
    private final SessionPlannerParticipantsModel participantsModel;
    private final SessionPlannerEncountersModel encountersModel;
    private final SessionPlannerStatePanelModel statePanelModel;

    SessionPlannerPublishedModelsServiceAssembly(Runnable loadPublishedState) {
        this.loadPublishedState = loadPublishedState;
        this.currentSessionModel = new SessionPlannerCurrentSessionModel(
                () -> {
                    loadPublishedState.run();
                    return sessions.current();
                },
                sessions::subscribe);
        this.participantsModel = new SessionPlannerParticipantsModel(
                () -> {
                    loadPublishedState.run();
                    return participants.current();
                },
                participants::subscribe);
        this.encountersModel = new SessionPlannerEncountersModel(
                () -> {
                    loadPublishedState.run();
                    return encounters.current();
                },
                encounters::subscribe);
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

    SessionPlannerParticipantsModel participantsModel() {
        return participantsModel;
    }

    SessionPlannerEncountersModel encountersModel() {
        return encountersModel;
    }

    SessionPlannerStatePanelModel statePanelModel() {
        return statePanelModel;
    }

    void publishSession(SessionPlannerSessionSnapshot snapshot) {
        sessions.publish(snapshot);
    }

    void publishParticipants(SessionPlannerParticipantsProjection projection) {
        participants.publish(projection);
    }

    void publishEncounters(SessionPlannerEncountersProjection projection) {
        encounters.publish(projection);
    }

    void publishStatePanel(SessionPlannerStatePanelProjection projection) {
        statePanel.publish(projection);
    }
}
