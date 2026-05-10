package src.domain.party.model.roster.repository;

import java.util.List;
import src.domain.party.model.roster.model.PartyMutationStatus;

public interface PartyRuntimeRepository {

    void recordMutationStatus(PartyMutationStatus status);

    void recordStorageErrorMutation();

    void publishAdventuringDayCalculation(List<Integer> levels, int totalGroupXp);
}
