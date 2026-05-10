package src.domain.party.model.roster.repository;

import java.util.List;
import src.domain.party.model.roster.model.PartyMutationStatus;

public interface PartyPublishedStateRepository {

    void publishRepositoryBackedState();

    void publishMutationStatus(PartyMutationStatus status);

    void publishStorageErrorMutation();

    void publishAdventuringDayCalculation(List<Integer> levels, int totalGroupXp);
}
