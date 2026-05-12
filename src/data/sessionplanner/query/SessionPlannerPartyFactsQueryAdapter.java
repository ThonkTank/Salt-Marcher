package src.data.sessionplanner.query;

import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.model.session.model.SessionAdventuringDayBudgetFact;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;

public final class SessionPlannerPartyFactsQueryAdapter implements SessionPartyFactsPort {

    private final SessionPlannerPartyFactsPublishedReadback partyReadback;

    public SessionPlannerPartyFactsQueryAdapter(
            ActivePartyModel activePartyModel,
            AdventuringDayCalculationModel adventuringDayCalculationModel
    ) {
        this.partyReadback = new SessionPlannerPartyFactsPublishedReadback(
                activePartyModel,
                adventuringDayCalculationModel);
    }

    @Override
    public ActivePartyMembersFact activePartyMembers() {
        return partyReadback.activePartyMembers();
    }

    @Override
    public SessionAdventuringDayBudgetFact adventuringDayFact() {
        return partyReadback.currentAdventuringDayFact();
    }
}
