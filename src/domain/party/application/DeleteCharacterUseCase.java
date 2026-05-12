package src.domain.party.application;

import java.util.Objects;
import src.domain.party.model.roster.helper.PartyRosterMutationHelper;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class DeleteCharacterUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyRosterMutationHelper mutations = new PartyRosterMutationHelper();

    public DeleteCharacterUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(long id) {
        try {
            PartyMutationStatus status = delete(id);
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus delete(long id) {
        PartyRoster roster = repository.load();
        java.util.List<src.domain.party.model.roster.model.PartyCharacter> nextCharacters =
                mutations.remove(roster.characters(), id);
        if (nextCharacters.isEmpty()) {
            return PartyMutationStatus.NOT_FOUND;
        }
        repository.save(roster.withCharacters(nextCharacters));
        return PartyMutationStatus.SUCCESS;
    }

    private void publish(PartyMutationStatus status) {
        if (status == PartyMutationStatus.SUCCESS) {
            publishedStateRepository.publishRepositoryBackedState();
        }
        publishedStateRepository.publishMutationStatus(status);
    }
}
