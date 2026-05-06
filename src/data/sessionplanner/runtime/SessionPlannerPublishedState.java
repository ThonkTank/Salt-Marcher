package src.data.sessionplanner.runtime;

import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;

record SessionPlannerPublishedState(
        SessionPlannerSessionSnapshot session,
        SessionPlannerParticipantsProjection participants,
        SessionPlannerEncountersProjection encounters,
        SessionPlannerStatePanelProjection statePanel
) {
}
