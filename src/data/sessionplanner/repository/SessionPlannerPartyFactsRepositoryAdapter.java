package src.data.sessionplanner.repository;

import java.util.List;
import java.util.Objects;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.sessionplanner.model.session.model.SessionAdventuringDayBudgetFact;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;

public final class SessionPlannerPartyFactsRepositoryAdapter implements SessionPartyFactsRepository {

    private final PartyApplicationService party;
    private final SessionPartyFactsPort partyFacts;

    public SessionPlannerPartyFactsRepositoryAdapter(
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
