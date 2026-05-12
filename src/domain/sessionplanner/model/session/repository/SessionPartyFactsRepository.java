package src.domain.sessionplanner.model.session.repository;

import java.util.List;

public interface SessionPartyFactsRepository {

    AdventuringDayBudgetFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp);

    record AdventuringDayBudgetFact(
            boolean available,
            int totalBudgetXp,
            int firstShortRestXp,
            int secondShortRestXp,
            int recommendedShortRests,
            int recommendedLongRests
    ) {

        public static AdventuringDayBudgetFact unavailable() {
            return new AdventuringDayBudgetFact(false, 0, 0, 0, 0, 0);
        }
    }
}
