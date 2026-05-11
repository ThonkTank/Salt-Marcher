package src.domain.party.model.roster.repository;

import java.util.List;
import src.domain.party.published.MutationStatus;

public interface PartyPublishedStateRepository {

    void publishRepositoryBackedState();

    void publishMutationStatus(MutationStatus status);

    void publishStorageErrorMutation();

    void publishAdventuringDayCalculation(List<Integer> levels, int totalGroupXp);
}
