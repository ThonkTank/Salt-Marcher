package src.domain.party.model.roster.repository;

import java.util.List;
import src.domain.party.model.roster.model.PartyMutationStatus;

public interface PartyPublishedStateRepository {

    void publishRepositoryBackedState(StatePublication publication);

    void publishMutationStatus(PartyMutationStatus status);

    void publishStorageErrorMutation(StatePublication publication);

    void publishAdventuringDayCalculation(AdventuringDayCalculationPublication publication);

    record StatePublication() {
    }

    record AdventuringDayCalculationPublication(List<Integer> levels, int totalGroupXp) {

        public AdventuringDayCalculationPublication {
            levels = levels == null ? List.of() : List.copyOf(levels);
        }
    }
}
