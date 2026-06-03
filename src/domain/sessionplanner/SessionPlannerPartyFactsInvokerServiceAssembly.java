package src.domain.sessionplanner;

import java.util.List;
import java.util.Objects;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.sessionplanner.model.session.SessionAdventuringDayBudgetFact;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;

final class SessionPlannerPartyFactsInvokerServiceAssembly implements SessionPartyFactsRepository {

    private final PartyApplicationService party;
    private final SessionPartyFactsPort partyFacts;

    SessionPlannerPartyFactsInvokerServiceAssembly(
            PartyApplicationService party,
            SessionPartyFactsPort partyFacts
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.partyFacts = Objects.requireNonNull(partyFacts, "partyFacts");
    }

    @Override
    public SessionAdventuringDayBudgetFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp) {
        party.calculateAdventuringDay(new CalculateAdventuringDayCommand(levels, plannedEncounterXp));
        return partyFacts.adventuringDayFact();
    }
}
