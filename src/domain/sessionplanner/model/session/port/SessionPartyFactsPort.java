package src.domain.sessionplanner.model.session.port;

import src.domain.sessionplanner.model.session.model.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.model.SessionAdventuringDayBudgetFact;

public interface SessionPartyFactsPort {

    SessionActivePartyMembersFact activePartyMembers();

    SessionAdventuringDayBudgetFact adventuringDayFact();
}
