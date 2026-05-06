package src.domain.party.roster.port;

import java.util.List;
import src.domain.party.roster.value.PartyMutationStatus;

public interface PartyRuntimeRepository {

    void recordMutationStatus(PartyMutationStatus status);

    void recordStorageErrorMutation();

    void publishAdventuringDayCalculation(List<Integer> levels, int totalGroupXp);
}
