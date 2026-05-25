package src.view.leftbartabs.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

public final class SessionPlannerContributionModel {

    private final SessionPlannerControlsContentModel controlsContentModel;
    private final SessionPlannerTimelineMainContentModel timelineMainContentModel;
    private final SessionPlannerStateContentModel stateContentModel;

    SessionPlannerContributionModel(
            SessionPlannerControlsContentModel controlsContentModel,
            SessionPlannerTimelineMainContentModel timelineMainContentModel,
            SessionPlannerStateContentModel stateContentModel
    ) {
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.timelineMainContentModel = Objects.requireNonNull(timelineMainContentModel, "timelineMainContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
    }

    void bindReadback(
            SessionPlannerCurrentSessionModel sessionModel,
            SessionPlannerParticipantsModel participantsModel,
            SessionPlannerEncountersModel encountersModel,
            SessionPlannerStatePanelModel statePanelModel
    ) {
        sessionModel.subscribe(controlsContentModel::applySession);
        participantsModel.subscribe(controlsContentModel::applyParticipants);
        encountersModel.subscribe(timelineMainContentModel::applyEncounters);
        statePanelModel.subscribe(stateContentModel::applyStatePanel);
        controlsContentModel.applySession(sessionModel.current());
        controlsContentModel.applyParticipants(participantsModel.current());
        timelineMainContentModel.applyEncounters(encountersModel.current());
        stateContentModel.applyStatePanel(statePanelModel.current());
    }
}
