package src.domain.party.application;

import java.util.List;
import java.util.Objects;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.model.PartyRosterMutation;
import src.domain.party.model.roster.model.PartyTravelLocation;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class MovePartyCharactersUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;

    public MovePartyCharactersUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(
            List<Long> characterIds,
            PartyTravelLocation location,
            boolean attachToPartyToken
    ) {
        try {
            PartyMutationStatus status = move(characterIds, location, attachToPartyToken);
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus move(
            List<Long> characterIds,
            PartyTravelLocation location,
            boolean attachToPartyToken
    ) {
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = roster.moveCharacters(characterIds, location, attachToPartyToken);
        if (mutation.successful()) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }

    private void publish(PartyMutationStatus status) {
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            publishedStateRepository.publishRepositoryBackedState();
        }
        publishedStateRepository.publishMutationStatus(status);
    }
}
