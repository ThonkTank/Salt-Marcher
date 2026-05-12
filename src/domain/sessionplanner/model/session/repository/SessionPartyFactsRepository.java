package src.domain.sessionplanner.model.session.repository;

import java.util.List;
import src.domain.sessionplanner.model.session.model.SessionAdventuringDayBudgetFact;

public interface SessionPartyFactsRepository {

    SessionAdventuringDayBudgetFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp);
}
