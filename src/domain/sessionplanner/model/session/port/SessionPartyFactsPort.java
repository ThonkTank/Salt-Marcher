package src.domain.sessionplanner.model.session.port;

import src.domain.sessionplanner.model.session.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.SessionAdventuringDayBudgetFact;

public interface SessionPartyFactsPort {

    SessionActivePartyMembersFact activePartyMembers();

    SessionAdventuringDayBudgetFact adventuringDayFact();
}
