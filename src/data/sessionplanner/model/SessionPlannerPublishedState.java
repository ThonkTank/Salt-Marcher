package src.data.sessionplanner.model;

import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;

public record SessionPlannerPublishedState(
        SessionPlannerSessionSnapshot session,
        SessionPlannerParticipantsProjection participants,
        SessionPlannerEncountersProjection encounters,
        SessionPlannerStatePanelProjection statePanel
) {
}
