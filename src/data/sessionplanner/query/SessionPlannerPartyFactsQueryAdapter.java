package src.data.sessionplanner.query;

import java.util.List;
import java.util.Objects;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;

public final class SessionPlannerPartyFactsQueryAdapter implements SessionPartyFactsPort {

    private final PartyApplicationService party;
    private final SessionPlannerPartyFactsPublishedReadback partyReadback;

    public SessionPlannerPartyFactsQueryAdapter(
            PartyApplicationService party,
            ActivePartyModel activePartyModel,
            AdventuringDayCalculationModel adventuringDayCalculationModel
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.partyReadback = new SessionPlannerPartyFactsPublishedReadback(
                activePartyModel,
                adventuringDayCalculationModel);
    }

    @Override
    public ActivePartyMembersFact loadActivePartyMembers() {
        return partyReadback.loadActivePartyMembers();
    }

    @Override
    public AdventuringDayFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp) {
        party.calculateAdventuringDay(new CalculateAdventuringDayCommand(levels, plannedEncounterXp));
        return partyReadback.currentAdventuringDayFact();
    }
}
